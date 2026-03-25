import React, { useState, useEffect } from 'react';
import {
    StyleSheet, Text, View, ScrollView, TouchableOpacity, Platform,
    TextInput, KeyboardAvoidingView, ActivityIndicator, Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useTranslation } from 'react-i18next';
import Toast from 'react-native-toast-message';
import { signInWithApple, signInWithGoogle } from '../../lib/socialAuth';
import { LinearGradient } from 'expo-linear-gradient';

export default function AccountScreen({ navigation }: any) {
    const { t } = useTranslation();
    const [session, setSession] = useState<any>(null);
    const [profile, setProfile] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);

    // Form states
    const [newUsername, setNewUsername] = useState('');
    const [editingUsername, setEditingUsername] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoginMode, setIsLoginMode] = useState(false);
    const [confirmModal, setConfirmModal] = useState<{
        visible: boolean;
        title: string;
        desc: string;
        onConfirm: () => void;
        isDestructive?: boolean;
    }>({ 
        visible: false, title: '', desc: '', onConfirm: () => {} 
    });

    const getLinkedProviders = () => {
        const identities = session?.user?.identities || [];
        const providers = identities.map((id: any) => id.provider);
        
        console.log('[Account] getLinkedProviders - identities:', identities);
        console.log('[Account] getLinkedProviders - providers:', providers);
        console.log('[Account] getLinkedProviders - app_metadata:', JSON.stringify(session?.user?.app_metadata));
        console.log('[Account] getLinkedProviders - email:', session?.user?.email);
        console.log('[Account] getLinkedProviders - is_anonymous:', session?.user?.is_anonymous);

        // Fallback 1: app_metadata.providers
        if (providers.length === 0 && session?.user?.app_metadata?.providers) {
            providers.push(...session.user.app_metadata.providers);
        }
        
        // Fallback 2: app_metadata.provider
        if (providers.length === 0 && session?.user?.app_metadata?.provider) {
            providers.push(session.user.app_metadata.provider);
        }

        // Fallback 3: email (ground truth for many accounts)
        if (session?.user?.email && !session?.user?.email.includes('anonymous')) {
            providers.push('email');
        }
        
        const finalProviders = [...new Set(providers)];
        console.log('[Account] getLinkedProviders - final:', finalProviders);
        return finalProviders;
    };

    const linkedProviders = getLinkedProviders();
    // is_account_linked from DB is just a hint; we trust the Auth session for the providers display.
    const isLinked = linkedProviders.length > 0 || (session?.user?.email && !session?.user?.is_anonymous);

    useEffect(() => {
        loadData();

        const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const loadData = async () => {
        try {
            // Use getUser() for fresh and complete user data (including identities)
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            
            console.log('[Account] LoadData currentUser identities:', currentUser?.identities);
            console.log('[Account] LoadData currentSession user identities:', currentSession?.user?.identities);

            // If currentUser has more info, prefer it for the session state
            if (currentUser && !currentSession?.user?.identities && currentUser.identities) {
                console.log('[Account] LoadData: Enhancing session user with identities from getUser()');
                if (currentSession) {
                    currentSession.user = currentUser as any;
                }
            }

            setSession(currentSession);

            if (currentSession?.user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', currentSession.user.id)
                    .maybeSingle();

                if (profileData) {
                    setProfile(profileData);
                    setNewUsername(profileData.username || '');
                }
            }
        } catch (e) {
            console.error('[Account] Load error:', e);
        } finally {
            setLoading(false);
        }
    };

    // === USERNAME ===
    const handleUpdateUsername = async () => {
        if (!newUsername.trim()) {
            Toast.show({ type: 'error', text1: t('app.error'), text2: t('app.empty_username') });
            return;
        }

        setIsUpdating(true);
        try {
            if (newUsername.trim() !== profile?.username) {
                const { data: existingUser, error: checkError } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('username', newUsername.trim())
                    .maybeSingle();

                if (existingUser && checkError === null) {
                    Toast.show({ type: 'error', text1: t('app.error'), text2: t('app.username_taken') });
                    setIsUpdating(false);
                    return;
                }
            }

            const { error } = await supabase
                .from('profiles')
                .update({ username: newUsername.trim() })
                .eq('id', session?.user?.id);

            if (error) throw error;

            setProfile({ ...profile, username: newUsername.trim() });
            setEditingUsername(false);
            Toast.show({ type: 'success', text1: t('app.success'), text2: t('app.username_updated') });
        } catch (e: any) {
            Toast.show({ type: 'error', text1: t('app.error'), text2: e.message || 'Error' });
        } finally {
            setIsUpdating(false);
        }
    };

    // === EMAIL/PASSWORD LINK ===
    const handleLinkAccount = async () => {
        if (!email.includes('@') || !email.includes('.')) {
            Toast.show({ type: 'error', text1: t('app.error'), text2: t('app.invalid_email') });
            return;
        }
        if (password.length < 6) {
            Toast.show({ type: 'error', text1: t('app.error'), text2: t('app.password_short') });
            return;
        }

        setIsUpdating(true);
        try {
            const { error } = await supabase.auth.updateUser({
                email: email.trim(),
                password: password,
            });

            if (error) throw error;

            await supabase
                .from('profiles')
                .update({ is_account_linked: true })
                .eq('id', session?.user?.id);

            await supabase.auth.refreshSession();
            const { data: { session: newSession } } = await supabase.auth.getSession();
            if (newSession) setSession(newSession);

            setEmail('');
            setPassword('');
            Toast.show({ type: 'success', text1: t('app.success'), text2: t('app.linking_success') });
            loadData();
        } catch (e: any) {
            const errorMsg = e.message || '';
            if (errorMsg.includes('already registered') || errorMsg.includes('already been registered') ||
                errorMsg.includes('email address') || errorMsg.includes('already') || errorMsg.includes('duplicate')) {
                Toast.show({
                    type: 'info',
                    text1: t('app.account_exists_title', 'Account Already Exists'),
                    text2: t('app.account_exists_use_login', 'This email is already registered. Please use "Log In" instead.'),
                });
                setIsLoginMode(true);
            } else {
                Toast.show({ type: 'error', text1: t('app.error'), text2: errorMsg || 'Error linking account' });
            }
        } finally {
            setIsUpdating(false);
        }
    };

    // === EMAIL/PASSWORD LOGIN ===
    const handleLogin = async () => {
        if (!email.includes('@') || !email.includes('.')) {
            Toast.show({ type: 'error', text1: t('app.error'), text2: t('app.invalid_email') });
            return;
        }
        if (password.length < 6) {
            Toast.show({ type: 'error', text1: t('app.error'), text2: t('app.password_short') });
            return;
        }

        setIsUpdating(true);
        try {
            const { data: signInData, error } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password: password,
            });

            if (error) throw error;

            if (signInData?.user) {
                const { data: profileData } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', signInData.user.id)
                    .maybeSingle();

                if (profileData) {
                    setProfile(profileData);
                    setNewUsername(profileData.username || '');
                }
            }

            setEmail('');
            setPassword('');
            Toast.show({ type: 'success', text1: t('app.success'), text2: t('app.login_success', 'Logged in successfully!') });
        } catch (e: any) {
            Toast.show({ type: 'error', text1: t('app.error'), text2: e.message || 'Login failed' });
        } finally {
            setIsUpdating(false);
        }
    };

    // === LOGOUT ===
    const handleLogout = async () => {
        setConfirmModal({
            visible: true,
            title: t('app.logout_confirm_title', 'Log Out?'),
            desc: t('app.logout_confirm_desc', 'Are you sure you want to log out?'),
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, visible: false }));
                try {
                    const { error } = await supabase.auth.signOut();
                    if (error) throw error;
                    Toast.show({ type: 'success', text1: t('app.success'), text2: t('app.logout_success', 'Logged out successfully!') });
                    navigation.goBack();
                } catch (e: any) {
                    Toast.show({ type: 'error', text1: t('app.error'), text2: e.message || 'Logout failed' });
                }
            }
        });
    };

    // === DELETE ACCOUNT ===
    const handleDeleteAccount = async () => {
        setConfirmModal({
            visible: true,
            title: t('app.delete_account_confirm_title', 'Delete Account?'),
            desc: t('app.delete_account_confirm_desc', 'Are you sure? This will permanently delete your account and all data.'),
            isDestructive: true,
            onConfirm: async () => {
                setConfirmModal(prev => ({ ...prev, visible: false }));
                setIsUpdating(true);
                try {
                    const { error } = await supabase.rpc('delete_user');
                    if (error) throw error;
                    
                    await supabase.auth.signOut();
                    Toast.show({ type: 'success', text1: t('app.success'), text2: t('app.delete_success', 'Account deleted') });
                    navigation.goBack();
                } catch (e: any) {
                    Toast.show({ type: 'error', text1: t('app.error'), text2: e.message || 'Deletion failed' });
                } finally {
                    setIsUpdating(false);
                }
            }
        });
    };

    // === APPLE SIGN-IN ===
    const handleAppleSignIn = async () => {
        setIsUpdating(true);
        try {
            const result = await signInWithApple();
            if (result.error === 'cancelled') {
                // User cancelled — do nothing
                return;
            }
            if (!result.success) {
                Toast.show({ type: 'error', text1: t('app.error'), text2: result.error || 'Apple Sign-In failed' });
                return;
            }
            Toast.show({ type: 'success', text1: t('app.success'), text2: t('app.login_success', 'Logged in successfully!') });
            loadData();
        } finally {
            setIsUpdating(false);
        }
    };

    // === GOOGLE SIGN-IN ===
    const handleGoogleSignIn = async () => {
        setIsUpdating(true);
        try {
            const result = await signInWithGoogle();
            if (result.error === 'cancelled') {
                return;
            }
            if (!result.success) {
                Toast.show({ type: 'error', text1: t('app.error'), text2: result.error || 'Google Sign-In failed' });
                return;
            }
            Toast.show({ type: 'success', text1: t('app.success'), text2: t('app.login_success', 'Logged in successfully!') });
            loadData();
        } finally {
            setIsUpdating(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color="#FF007F" />
            </View>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('app.account_settings', 'Account Settings')}</Text>
                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                    {/* === USERNAME SECTION === */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            <Ionicons name="person-outline" size={18} color="#FFD700" /> {t('app.username', 'Username')}
                        </Text>
                        {editingUsername ? (
                            <View>
                                <TextInput
                                    style={styles.textInput}
                                    value={newUsername}
                                    onChangeText={setNewUsername}
                                    placeholder={t('app.username_placeholder', 'New username')}
                                    placeholderTextColor="#888"
                                    autoCapitalize="none"
                                    maxLength={20}
                                />
                                <View style={styles.btnRow}>
                                    <TouchableOpacity
                                        style={[styles.actionBtn, { backgroundColor: '#333' }]}
                                        onPress={() => { setEditingUsername(false); setNewUsername(profile?.username || ''); }}
                                        disabled={isUpdating}
                                    >
                                        <Text style={styles.btnText}>{t('app.cancel_btn', 'Cancel')}</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity style={styles.actionBtn} onPress={handleUpdateUsername} disabled={isUpdating}>
                                        {isUpdating ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.btnText}>{t('app.save_btn', 'Save')}</Text>}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ) : (
                            <TouchableOpacity style={styles.editRow} onPress={() => setEditingUsername(true)}>
                                <Text style={styles.editRowValue}>@{profile?.username || '—'}</Text>
                                <Ionicons name="pencil" size={16} color="#FF007F" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* === ACCOUNT STATUS === */}
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            <Ionicons name="shield-checkmark-outline" size={18} color="#FFD700" /> {t('app.account_status', 'Account Status')}
                        </Text>
                        {isLinked ? (
                            <View>
                                <View style={styles.statusRow}>
                                    <Ionicons name="checkmark-circle" size={20} color="#00FF88" />
                                    <Text style={styles.statusLinked}>{t('app.account_linked', 'Account is secured')}</Text>
                                </View>
                                <View style={styles.providerRow}>
                                    {linkedProviders.map((p: string) => (
                                        <View key={p} style={styles.providerBadge}>
                                            <Ionicons 
                                                name={p === 'apple' ? 'logo-apple' : p === 'google' ? 'logo-google' : 'mail'} 
                                                size={14} 
                                                color="#FFFFFF" 
                                            />
                                            <Text style={styles.providerBadgeText}>{p.charAt(0).toUpperCase() + p.slice(1)}</Text>
                                        </View>
                                    ))}
                                </View>
                            </View>
                        ) : (
                            <View style={styles.statusRow}>
                                <Ionicons name="warning-outline" size={20} color="#FFD700" />
                                <Text style={styles.statusUnlinked}>{t('app.account_not_linked', 'Account is not secured yet')}</Text>
                            </View>
                        )}
                        {session?.user?.email && !session?.user?.is_anonymous && (
                            <Text style={styles.emailText}>✉️ {session.user.email}</Text>
                        )}
                    </View>

                    {/* === SECURE / LOGIN SECTIONS (Only if NOT linked) === */}
                    {!isLinked ? (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>
                                <Ionicons name="shield-outline" size={18} color="#F0F0F0" /> {isLoginMode ? t('app.login_existing', 'Log In') : t('app.link_account', 'Secure Your Account')}
                            </Text>
                            <Text style={styles.sectionDesc}>
                                {isLoginMode ? t('app.login_desc', 'Log in to your account.') : t('app.link_account_desc', 'Connect an account to save data.')}
                            </Text>

                            {/* Social Buttons (Unified) */}
                            {Platform.OS === 'ios' && (
                                <TouchableOpacity style={[styles.socialBtn, styles.appleBtn]} onPress={handleAppleSignIn} disabled={isUpdating}>
                                    <Ionicons name="logo-apple" size={22} color="white" />
                                    <Text style={styles.socialBtnText}>{isLoginMode ? t('app.login_apple', 'Log In with Apple') : t('app.continue_apple', 'Continue with Apple')}</Text>
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity style={[styles.socialBtn, styles.googleBtn]} onPress={handleGoogleSignIn} disabled={isUpdating}>
                                <Ionicons name="logo-google" size={20} color="white" />
                                <Text style={styles.socialBtnText}>{isLoginMode ? t('app.login_google', 'Log In with Google') : t('app.continue_google', 'Continue with Google')}</Text>
                            </TouchableOpacity>

                            <View style={styles.divider}>
                                <View style={styles.dividerLine} /><Text style={styles.dividerText}>{t('app.or', 'or')}</Text><View style={styles.dividerLine} />
                            </View>

                            {/* Email/Password Form */}
                            <View style={styles.formContainer}>
                                <TextInput 
                                    style={styles.textInput} 
                                    placeholder={t('app.email_placeholder', 'Email')} 
                                    placeholderTextColor="#888" 
                                    value={email} 
                                    onChangeText={setEmail} 
                                    keyboardType="email-address" 
                                    autoCapitalize="none" 
                                />
                                <TextInput 
                                    style={styles.textInput} 
                                    placeholder={t('app.password_placeholder', 'Password')} 
                                    placeholderTextColor="#888" 
                                    value={password} 
                                    onChangeText={setPassword} 
                                    secureTextEntry 
                                />
                                
                                <TouchableOpacity 
                                    style={styles.toggleRow} 
                                    onPress={() => setIsLoginMode(!isLoginMode)}
                                >
                                    <Ionicons 
                                        name={isLoginMode ? "checkbox" : "square-outline"} 
                                        size={20} 
                                        color={isLoginMode ? "#FF007F" : "#888"} 
                                    />
                                    <Text style={styles.toggleText}>
                                        {t('app.already_have_account', 'Already have an account?')}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity 
                                    style={styles.actionBtn} 
                                    onPress={isLoginMode ? handleLogin : handleLinkAccount} 
                                    disabled={isUpdating}
                                >
                                    {isUpdating ? <ActivityIndicator color="#fff" size="small" /> : (
                                        <Text style={styles.btnText}>
                                            {isLoginMode ? t('app.login_btn', 'Log In') : t('app.connect_btn', 'Connect')}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.section}>
                            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} disabled={isUpdating}>
                                <Ionicons name="log-out-outline" size={20} color="#E0E0E0" />
                                <Text style={styles.logoutBtnText}>{t('app.logout_btn', 'Log Out')}</Text>
                            </TouchableOpacity>
                            
                            <View style={[styles.divider, { marginVertical: 8, opacity: 0.1 }]}>
                                <View style={styles.dividerLine} />
                            </View>

                            <TouchableOpacity style={styles.logoutBtn} onPress={handleDeleteAccount} disabled={isUpdating}>
                                <Ionicons name="trash-outline" size={20} color="#E0E0E0" />
                                <Text style={styles.logoutBtnText}>{t('app.delete_account_btn', 'Delete Account')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Privacy note */}
                    <View style={styles.privacyNote}>
                        <Ionicons name="information-circle-outline" size={16} color="#888" />
                        <Text style={styles.privacyText}>
                            {t('app.why_email_desc', 'We only use your email to secure your purchases and allow you to log in from other devices. We never send spam.')}
                        </Text>
                    </View>

                </ScrollView>
            </KeyboardAvoidingView>

            {/* === CONFIRMATION MODAL === */}
            <Modal
                transparent
                visible={confirmModal.visible}
                animationType="fade"
                onRequestClose={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>{confirmModal.title}</Text>
                        <Text style={styles.modalDesc}>{confirmModal.desc}</Text>
                        <View style={styles.modalBtnRow}>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: '#333' }]} 
                                onPress={() => setConfirmModal(prev => ({ ...prev, visible: false }))}
                            >
                                <Text style={styles.modalBtnText}>{t('app.cancel_btn', 'Cancel')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.modalBtn, { backgroundColor: confirmModal.isDestructive ? '#FF0000' : '#FF007F' }]} 
                                onPress={confirmModal.onConfirm}
                            >
                                <Text style={styles.modalBtnText}>
                                    {confirmModal.isDestructive ? t('app.delete_confirm_btn', 'Delete') : t('app.confirm_btn', 'Confirm')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0A001A' },
    centerContainer: { flex: 1, backgroundColor: '#0A001A', justifyContent: 'center', alignItems: 'center' },
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#2a3b5e',
    },
    backBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
    headerTitle: { color: '#FFD700', fontSize: 20, fontWeight: '900' },
    scrollContent: { padding: 20, paddingBottom: 40 },

    // Sections
    section: {
        backgroundColor: '#1A0B2E', borderRadius: 15, padding: 20, marginBottom: 20,
        borderWidth: 1, borderColor: '#2a3b5e',
    },
    sectionTitle: { color: '#F0F0F0', fontSize: 18, fontWeight: '900', marginBottom: 12 },
    sectionDesc: { color: '#aaa', fontSize: 14, marginBottom: 16, lineHeight: 20 },

    // Edit row
    editRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        backgroundColor: '#2a3b5e', padding: 14, borderRadius: 10,
    },
    editRowValue: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    // Status
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
    statusLinked: { color: '#00FF88', fontSize: 15, fontWeight: 'bold' },
    statusUnlinked: { color: '#FFD700', fontSize: 15, fontWeight: 'bold' },
    emailText: { color: '#aaa', fontSize: 13, marginTop: 4, marginLeft: 30 },

    // Provider badges
    providerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12, marginLeft: 30 },
    providerBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12,
    },
    providerBadgeText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },

    // Social buttons
    socialBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
        padding: 16, borderRadius: 12, marginBottom: 10,
    },
    appleBtn: { backgroundColor: '#000', borderWidth: 1, borderColor: '#333' },
    googleBtn: { backgroundColor: '#4285F4' },
    emailBtn: { backgroundColor: 'rgba(255, 215, 0, 0.1)', borderWidth: 1, borderColor: 'rgba(255, 215, 0, 0.3)' },
    socialBtnText: { color: 'white', fontSize: 16, fontWeight: 'bold' },

    // Divider
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#2a3b5e' },
    dividerText: { color: '#888', marginHorizontal: 12, fontSize: 13 },

    // Forms
    formContainer: { marginTop: 5 },
    textInput: {
        backgroundColor: '#2a3b5e', color: 'white', padding: 14, borderRadius: 10,
        marginBottom: 10, fontSize: 15, borderWidth: 1, borderColor: '#3a4b6e',
    },
    btnRow: { flexDirection: 'row', gap: 10 },
    actionBtn: {
        backgroundColor: '#FF007F', padding: 16, borderRadius: 12,
        alignItems: 'center', justifyContent: 'center', marginTop: 10,
    },
    btnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 15, paddingVertical: 5 },
    toggleText: { color: '#aaa', fontSize: 14 },

    // Logout
    logoutBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-start', gap: 10,
        padding: 8, paddingLeft: 0,
    },
    logoutBtnText: { color: '#E0E0E0', fontWeight: '500', fontSize: 16 },

    // Privacy
    privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingHorizontal: 5, marginTop: 5 },
    privacyText: { color: '#666', fontSize: 12, flex: 1, lineHeight: 16 },

    // Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.8)',
        justifyContent: 'center', alignItems: 'center', padding: 20,
    },
    modalContent: {
        backgroundColor: '#1A0B2E', borderRadius: 20, padding: 24, width: '100%',
        borderWidth: 1, borderColor: '#2a3b5e',
    },
    modalTitle: { color: '#FFD700', fontSize: 20, fontWeight: '900', marginBottom: 12, textAlign: 'center' },
    modalDesc: { color: '#aaa', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 24 },
    modalBtnRow: { flexDirection: 'row', gap: 12 },
    modalBtn: { flex: 1, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    modalBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
});
