import React, { useState, useEffect, useCallback, useRef } from 'react';
import { 
    StyleSheet, Text, View, SafeAreaView, TouchableOpacity, 
    FlatList, Image, TextInput, KeyboardAvoidingView, Platform, 
    ActivityIndicator 
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRoute, useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';

interface Message {
    id: string;
    text: string;
    sender_id: string;
    created_at: string;
}

export default function ChatScreen() {
    const { t } = useTranslation();
    const route = useRoute<any>();
    const navigation = useNavigation();
    const { matchId, targetPet } = route.params;
    
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [loading, setLoading] = useState(true);
    const [myId, setMyId] = useState<string | null>(null);
    const flatListRef = useRef<FlatList>(null);

    useEffect(() => {
        let channel: any;

        const setupChat = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setMyId(user.id);

            // 1. Fetch existing messages
            const { data, error } = await supabase
                .from('messages')
                .select('*')
                .eq('match_id', matchId)
                .order('created_at', { ascending: true });

            if (!error) setMessages(data || []);
            setLoading(false);

            // 2. Set up Realtime subscription
            channel = supabase
                .channel(`match_${matchId}`)
                .on('postgres_changes', { 
                    event: 'INSERT', 
                    schema: 'public', 
                    table: 'messages', 
                    filter: `match_id=eq.${matchId}` 
                }, (payload) => {
                    const newMessage = payload.new as Message;
                    // Only add if it's not our own optimistic message (or just rely on unique IDs)
                    setMessages(prev => {
                        if (prev.find(m => m.id === newMessage.id)) return prev;
                        return [...prev, newMessage];
                    });
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                })
                .subscribe();
        };

        setupChat();

        return () => {
            if (channel) {
                supabase.removeChannel(channel);
            }
        };
    }, [matchId]);

    const sendMessage = async () => {
        if (!inputText.trim() || !myId) return;

        const textToSend = inputText.trim();
        const tempId = Math.random().toString(); // Optimistic ID
        
        // Optimistic Update: Add message to UI immediately
        const optimisticMessage: Message = {
            id: tempId,
            text: textToSend,
            sender_id: myId,
            created_at: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, optimisticMessage]);
        setInputText('');
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

        try {
            const { error } = await supabase
                .from('messages')
                .insert([{
                    match_id: matchId,
                    sender_id: myId,
                    text: textToSend
                }]);

            if (error) {
                // If error, remove optimistic message or show error
                setMessages(prev => prev.filter(m => m.id !== tempId));
                throw error;
            }
        } catch (error) {
            console.error('[Chat] Send error:', error);
        }
    };

    const renderMessage = ({ item }: { item: Message }) => {
        const isMine = item.sender_id === myId;
        return (
            <View style={[styles.messageWrapper, isMine ? styles.myMessageWrapper : styles.theirMessageWrapper]}>
                <View style={[styles.messageBubble, isMine ? styles.myBubble : styles.theirBubble]}>
                    <Text style={[styles.messageText, isMine ? styles.myText : styles.theirText]}>{item.text}</Text>
                </View>
                <Text style={styles.timestamp}>
                    {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
            </View>
        );
    };

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <View style={styles.headerInfo}>
                    <Image 
                        source={targetPet.image_url ? { uri: targetPet.image_url } : require('../../assets/icon.png')} 
                        style={styles.headerAvatar} 
                    />
                    <View>
                        <Text style={styles.headerName}>{targetPet.name}</Text>
                        <Text style={styles.headerStatus}>{t('pawmatch.online', 'Online')}</Text>
                    </View>
                </View>
                <TouchableOpacity style={styles.infoBtn}>
                    <Ionicons name="information-circle-outline" size={24} color="#6A4C93" />
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#FF007F" />
                </View>
            ) : (
                <FlatList
                    ref={flatListRef}
                    data={messages}
                    keyExtractor={(item) => item.id}
                    renderItem={renderMessage}
                    contentContainerStyle={styles.messageList}
                    onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
                />
            )}

            <KeyboardAvoidingView 
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
                keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
            >
                <View style={styles.inputArea}>
                    <TextInput 
                        style={styles.input}
                        placeholder={t('pawmatch.chat_placeholder', 'Say something nice...')}
                        placeholderTextColor="#6A4C93"
                        value={inputText}
                        onChangeText={setInputText}
                        multiline
                    />
                    <TouchableOpacity style={styles.sendBtn} onPress={sendMessage}>
                        <LinearGradient 
                            colors={['#FF007F', '#FF00FF']} 
                            style={styles.sendBtnGradient}
                        >
                            <Ionicons name="send" size={20} color="white" />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0A001A',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1A0B2E',
    },
    backBtn: {
        marginRight: 15,
    },
    headerInfo: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headerAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FF007F',
    },
    headerName: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    headerStatus: {
        color: '#00FF00',
        fontSize: 10,
        fontWeight: 'bold',
    },
    infoBtn: {
        padding: 5,
    },
    messageList: {
        padding: 20,
        paddingBottom: 40,
    },
    messageWrapper: {
        marginBottom: 15,
        maxWidth: '80%',
    },
    myMessageWrapper: {
        alignSelf: 'flex-end',
    },
    theirMessageWrapper: {
        alignSelf: 'flex-start',
    },
    messageBubble: {
        paddingHorizontal: 15,
        paddingVertical: 10,
        borderRadius: 20,
    },
    myBubble: {
        backgroundColor: '#FF007F',
        borderBottomRightRadius: 4,
    },
    theirBubble: {
        backgroundColor: '#15002C',
        borderBottomLeftRadius: 4,
        borderWidth: 1,
        borderColor: '#2D005A',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
    },
    myText: {
        color: 'white',
    },
    theirText: {
        color: '#D3C4E5',
    },
    timestamp: {
        fontSize: 9,
        color: '#6A4C93',
        marginTop: 4,
        alignSelf: 'flex-end',
    },
    inputArea: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 15,
        paddingBottom: Platform.OS === 'ios' ? 30 : 15,
        backgroundColor: '#0A001A',
        gap: 10,
    },
    input: {
        flex: 1,
        backgroundColor: '#15002C',
        borderRadius: 25,
        paddingHorizontal: 20,
        paddingVertical: 10,
        color: 'white',
        maxHeight: 100,
        borderWidth: 1,
        borderColor: '#2D005A',
    },
    sendBtn: {
        width: 45,
        height: 45,
        borderRadius: 22.5,
        overflow: 'hidden',
    },
    sendBtnGradient: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
