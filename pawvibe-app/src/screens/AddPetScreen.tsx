import React, { useState, useEffect } from 'react';
import { 
    StyleSheet, Text, View, TouchableOpacity, 
    TextInput, ScrollView, Image, ActivityIndicator, Alert, Modal, Platform 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../lib/supabase';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { decode } from 'base64-arraybuffer';
import breedsData from '../data/breeds.json';

export default function AddPetScreen() {
    const { t } = useTranslation();
    const navigation = useNavigation<any>();
    
    const [loading, setLoading] = useState(false);
    const [name, setName] = useState('');
    const [species, setSpecies] = useState<'dog' | 'cat'>('dog');
    const [gender, setGender] = useState<'male' | 'female'>('male');
    const [breed, setBreed] = useState('');
    const [birthDate, setBirthDate] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [image, setImage] = useState<string | null>(null);
    const [existingVaccinePets, setExistingVaccinePets] = useState<string[]>([]);
    
    const [showBreedModal, setShowBreedModal] = useState(false);
    const [breedSearch, setBreedSearch] = useState('');

    useEffect(() => {
        fetchExistingPetsFromVaccines();
    }, []);

    const fetchExistingPetsFromVaccines = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            const { data, error } = await supabase
                .from('vaccinations')
                .select('pet_name')
                .eq('user_id', user.id);

            if (error) throw error;

            const names = Array.from(new Set(data.map(v => v.pet_name)));
            const { data: existingPets } = await supabase.from('pets').select('name').eq('owner_id', user.id);
            const existingNames = existingPets?.map(p => p.name) || [];
            const availableNames = names.filter(n => !existingNames.includes(n));
            
            setExistingVaccinePets(availableNames);
        } catch (error) {
            console.error('[AddPet] Fetch vaccines error:', error);
        }
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true
        });

        if (!result.canceled) {
            setImage(result.assets[0].uri);
        }
    };

    const handleSave = async () => {
        if (!name.trim()) {
            Alert.alert(t('app.error'), t('app.name_required', 'Please enter a name'));
            return;
        }

        try {
            setLoading(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            let imageUrl = null;
            if (image) {
                const fileExt = image.split('.').pop();
                const fileName = `${user.id}/${Date.now()}.${fileExt}`;
                const filePath = fileName;

                const response = await fetch(image);
                const blob = await response.blob();
                const reader = new FileReader();
                
                const base64Data = await new Promise<string>((resolve) => {
                    reader.onloadend = () => resolve(reader.result as string);
                    reader.readAsDataURL(blob);
                });

                const base64 = base64Data.split(',')[1];

                const { error: uploadError } = await supabase.storage
                    .from('pet-photos')
                    .upload(filePath, decode(base64), {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('pet-photos')
                    .getPublicUrl(filePath);
                
                imageUrl = publicUrl;
            }

            const { error } = await supabase
                .from('pets')
                .insert([{
                    owner_id: user.id,
                    name: name.trim(),
                    species,
                    gender,
                    breed: breed || null,
                    birth_date: birthDate.toISOString().split('T')[0],
                    image_url: imageUrl,
                    is_searching: true
                }]);

            if (error) throw error;
            navigation.goBack();
        } catch (error: any) {
            Alert.alert(t('app.error'), error.message);
        } finally {
            setLoading(false);
        }
    };

    const availableBreeds = species === 'dog' ? breedsData.dogs : breedsData.cats;
    const filteredBreeds = availableBreeds.filter(b => b.toLowerCase().includes(breedSearch.toLowerCase()));

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Ionicons name="close" size={28} color="white" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('app.add_pet', 'Add New Pet')}</Text>
                <TouchableOpacity onPress={handleSave} disabled={loading} style={styles.saveBtn}>
                    {loading ? <ActivityIndicator size="small" color="#FFD700" /> : <Text style={styles.saveBtnText}>{t('app.save', 'Save')}</Text>}
                </TouchableOpacity>
            </View>

            <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage}>
                    {image ? (
                        <Image source={{ uri: image }} style={styles.previewImage} />
                    ) : (
                        <View style={styles.imagePlaceholder}>
                            <Ionicons name="camera" size={40} color="#6A4C93" />
                            <Text style={styles.imagePlaceholderText}>{t('app.add_photo', 'Add Photo')}</Text>
                        </View>
                    )}
                </TouchableOpacity>

                {existingVaccinePets.length > 0 && (
                    <View style={styles.importBox}>
                        <View style={styles.importHeader}>
                            <MaterialCommunityIcons name="auto-fix" size={20} color="#FFD700" />
                            <Text style={styles.importTitle}>{t('app.import_from_vaccines', 'Found in Vaccines')}</Text>
                        </View>
                        <View style={styles.chipContainer}>
                            {existingVaccinePets.map((petName) => (
                                <TouchableOpacity 
                                    key={petName} 
                                    style={styles.chip}
                                    onPress={() => {
                                        setName(petName);
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                >
                                    <Text style={styles.chipText}>{petName}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                <View style={styles.form}>
                    <Text style={styles.label}>{t('app.pet_name', 'Pet Name')}</Text>
                    <TextInput 
                        style={styles.input}
                        value={name}
                        onChangeText={setName}
                        placeholder="e.g. Buddy"
                        placeholderTextColor="#444"
                    />

                    <Text style={styles.label}>{t('app.species', 'Species')}</Text>
                    <View style={styles.toggleRow}>
                        <TouchableOpacity 
                            style={[styles.toggleBtn, species === 'dog' && styles.toggleBtnActive]}
                            onPress={() => {
                                setSpecies('dog');
                                setBreed('');
                            }}
                        >
                            <Ionicons name="paw" size={20} color={species === 'dog' ? 'black' : '#6A4C93'} />
                            <Text style={[styles.toggleText, species === 'dog' && styles.toggleTextActive]}>{t('app.dog', 'Dog')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.toggleBtn, species === 'cat' && styles.toggleBtnActive]}
                            onPress={() => {
                                setSpecies('cat');
                                setBreed('');
                            }}
                        >
                            <MaterialCommunityIcons name="cat" size={20} color={species === 'cat' ? 'black' : '#6A4C93'} />
                            <Text style={[styles.toggleText, species === 'cat' && styles.toggleTextActive]}>{t('app.cat', 'Cat')}</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>{t('app.gender', 'Gender')}</Text>
                    <View style={styles.toggleRow}>
                        <TouchableOpacity 
                            style={[styles.toggleBtn, gender === 'male' && styles.toggleBtnActive, gender === 'male' && {backgroundColor: '#4285F4'}]}
                            onPress={() => setGender('male')}
                        >
                            <Ionicons name="male" size={20} color={gender === 'male' ? 'white' : '#6A4C93'} />
                            <Text style={[styles.toggleText, gender === 'male' && {color: 'white'}]}>{t('app.male', 'Male')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            style={[styles.toggleBtn, gender === 'female' && styles.toggleBtnActive, gender === 'female' && {backgroundColor: '#FF007F'}]}
                            onPress={() => setGender('female')}
                        >
                            <Ionicons name="female" size={20} color={gender === 'female' ? 'white' : '#6A4C93'} />
                            <Text style={[styles.toggleText, gender === 'female' && {color: 'white'}]}>{t('app.female', 'Female')}</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.label}>{t('app.breed', 'Breed')}</Text>
                    <TouchableOpacity style={styles.input} onPress={() => setShowBreedModal(true)}>
                        <Text style={{ color: breed ? 'white' : '#6A4C93' }}>{breed || t('app.select_breed', 'Select Breed')}</Text>
                        <Ionicons name="chevron-down" size={20} color="#FFD700" style={{ position: 'absolute', right: 15, top: 15 }} />
                    </TouchableOpacity>

                    <Text style={styles.label}>{t('app.birth_date', 'Birth Date')}</Text>
                    <TouchableOpacity style={styles.datePickerBtn} onPress={() => setShowDatePicker(true)}>
                        <Ionicons name="calendar" size={20} color="#FFD700" />
                        <Text style={styles.dateText}>{birthDate.toLocaleDateString()}</Text>
                    </TouchableOpacity>

                    {showDatePicker && (
                        Platform.OS === 'ios' ? (
                            <Modal transparent animationType="slide" visible={showDatePicker}>
                                <View style={styles.datePickerModal}>
                                    <View style={styles.datePickerContainer}>
                                        <View style={styles.datePickerHeader}>
                                            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                                                <Text style={styles.doneBtnText}>{t('app.save_btn', 'Done')}</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <DateTimePicker
                                            value={birthDate}
                                            mode="date"
                                            display="spinner"
                                            textColor="white"
                                            onChange={(event, selectedDate) => {
                                                if (selectedDate) setBirthDate(selectedDate);
                                            }}
                                        />
                                    </View>
                                </View>
                            </Modal>
                        ) : (
                            <DateTimePicker
                                value={birthDate}
                                mode="date"
                                display="default"
                                onChange={(event, selectedDate) => {
                                    setShowDatePicker(false);
                                    if (selectedDate) setBirthDate(selectedDate);
                                }}
                            />
                        )
                    )}
                </View>
                <View style={{ height: 100 }} />
            </ScrollView>

            <Modal visible={showBreedModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>{t('app.select_breed', 'Select Breed')}</Text>
                            <TouchableOpacity onPress={() => setShowBreedModal(false)}>
                                <Ionicons name="close" size={28} color="white" />
                            </TouchableOpacity>
                        </View>
                        
                        <View style={styles.searchContainer}>
                            <Ionicons name="search" size={20} color="#6A4C93" style={styles.searchIcon} />
                            <TextInput 
                                style={styles.searchInput}
                                placeholder={t('app.search_breed', 'Search breed...')}
                                placeholderTextColor="#6A4C93"
                                value={breedSearch}
                                onChangeText={setBreedSearch}
                            />
                        </View>

                        <ScrollView style={styles.breedList}>
                            {filteredBreeds.map((b) => (
                                <TouchableOpacity 
                                    key={b} 
                                    style={styles.breedItem}
                                    onPress={() => {
                                        setBreed(b);
                                        setShowBreedModal(false);
                                        setBreedSearch('');
                                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                    }}
                                >
                                    <Text style={[styles.breedItemText, breed === b && {color: '#FFD700'}]}>{b}</Text>
                                    {breed === b && <Ionicons name="checkmark" size={20} color="#FFD700" />}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
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
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#1A0B2E',
    },
    backBtn: {
        width: 40,
        height: 40,
        justifyContent: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: 'white',
        textTransform: 'uppercase',
    },
    saveBtn: {
        paddingHorizontal: 15,
        paddingVertical: 8,
        backgroundColor: '#1A0B2E',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#FFD700',
    },
    saveBtnText: {
        color: '#FFD700',
        fontWeight: '900',
    },
    content: {
        flex: 1,
    },
    imagePicker: {
        alignSelf: 'center',
        width: 150,
        height: 150,
        borderRadius: 75,
        backgroundColor: '#15002C',
        marginTop: 30,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#2D005A',
        overflow: 'hidden',
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
    imagePlaceholder: {
        alignItems: 'center',
    },
    imagePlaceholderText: {
        color: '#6A4C93',
        fontSize: 12,
        marginTop: 5,
        fontWeight: 'bold',
    },
    importBox: {
        backgroundColor: '#1A0B2E',
        margin: 20,
        padding: 15,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#FFD70033',
    },
    importHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    importTitle: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    chipContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        backgroundColor: '#2D005A',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
    },
    chipText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    form: {
        padding: 20,
    },
    label: {
        color: '#FFD700',
        fontSize: 12,
        fontWeight: '900',
        marginBottom: 10,
        textTransform: 'uppercase',
        marginTop: 20,
    },
    input: {
        backgroundColor: '#15002C',
        borderWidth: 1,
        borderColor: '#2D005A',
        borderRadius: 15,
        padding: 15,
        color: 'white',
        fontSize: 16,
        justifyContent: 'center',
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 15,
    },
    toggleBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#15002C',
        paddingVertical: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#2D005A',
        gap: 8,
    },
    toggleBtnActive: {
        backgroundColor: '#FFD700',
        borderColor: '#FFD700',
    },
    toggleText: {
        color: '#6A4C93',
        fontWeight: 'bold',
    },
    toggleTextActive: {
        color: 'black',
    },
    datePickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#15002C',
        padding: 15,
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#2D005A',
        gap: 10,
    },
    dateText: {
        color: 'white',
        fontSize: 16,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10,0,26,0.95)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#15002C',
        borderTopLeftRadius: 30,
        borderTopRightRadius: 30,
        height: '80%',
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    modalTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: '900',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0A001A',
        borderRadius: 15,
        paddingHorizontal: 15,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: '#2D005A',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        height: 50,
        color: 'white',
        fontSize: 16,
    },
    breedList: {
        flex: 1,
    },
    breedItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 15,
        borderBottomWidth: 1,
        borderBottomColor: '#2D005A',
    },
    breedItemText: {
        color: '#D3C4E5',
        fontSize: 16,
    },
    datePickerModal: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)'
    },
    datePickerContainer: {
        backgroundColor: '#1A0B2E',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        paddingBottom: 40
    },
    datePickerHeader: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        padding: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)'
    },
    doneBtnText: {
        color: '#FFD700',
        fontWeight: 'bold',
        fontSize: 18
    }
});
