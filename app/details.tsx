import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
    Alert,
    Image,
    ScrollView,
    StyleSheet, Text,
    TextInput, TouchableOpacity,
    View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authStore } from './authStore';
import { inspectionStore } from './inspectionStore';
import { uploadInspection } from './services/api';

export default function DetailsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams(); // Still might receive initial params if any

    const [vin, setVin] = useState('');
    const [vinImage, setVinImage] = useState<string | null>(null);

    const [gpsImage, setGpsImage] = useState<string | null>(null);
    const [gpsData, setGpsData] = useState<{ lat: number, long: number, time: string } | null>(null);
    const [address, setAddress] = useState('Fetching... (Complete GPS Capture first)');

    const [faultImage, setFaultImage] = useState<string | null>(null);

    // Sync state with store on focus (returning from scan)
    useFocusEffect(
        useCallback(() => {
            const data = inspectionStore.getSnapshot();

            // Update local state if store has data
            if (data.vin) setVin(data.vin);
            if (data.vinImage) setVinImage(data.vinImage);
            if (data.gpsImage) setGpsImage(data.gpsImage);
            if (data.faultImage) setFaultImage(data.faultImage);
            if (data.gpsData) {
                setGpsData(data.gpsData);
                // Trigger address fetch if we have new GPS data
                getAddress(data.gpsData.lat, data.gpsData.long);
            } else {
                // If no GPS data in store, try current location for display only
                // but don't force it into store unless captured
                (async () => {
                    let { status } = await Location.requestForegroundPermissionsAsync();
                    if (status === 'granted') {
                        let loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                        if (!data.gpsData) { // Only show if we don't have captured data
                            getAddress(loc.coords.latitude, loc.coords.longitude);
                        }
                    }
                })();
            }
        }, [])
    );

    const getAddress = async (lat: number, long: number) => {
        try {
            let geocode = await Location.reverseGeocodeAsync({ latitude: lat, longitude: long });
            if (geocode.length > 0) {
                const g = geocode[0];
                setAddress(`${g.street || ''} ${g.name || ''}, ${g.city || ''}, ${g.region || ''} `);
            }
        } catch (e) {
            setAddress('Address unavailable');
        }
    };

    const openScanner = (mode: 'VIN' | 'GPS' | 'FAULT') => {
        // Save current manual input to store before navigating
        inspectionStore.update({ vin });
        router.push({
            pathname: '/scan',
            params: { mode }
        });
    };

    const handleSave = async () => {
        if (!vin) {
            Alert.alert('Missing VIN', 'Please enter or scan a VIN.');
            return;
        }

        // Prepare data
        const payload = {
            vin,
            gpsData: gpsData || {},
            vinImage: vinImage,
            gpsImage: gpsImage,
            faultImage: faultImage,
            mechanicId: authStore.mechanicId
        };

        if (!payload.mechanicId) {
            Alert.alert('Error', 'Session expired. Please login again.');
            router.replace('/');
            return;
        }

        try {
            await uploadInspection(authStore.token!, payload);

            Alert.alert('Success', 'Inspection record uploaded!', [
                {
                    text: 'OK', onPress: () => {
                        inspectionStore.reset();
                        router.push('/home');
                    }
                }
            ]);
        } catch (e: any) {
            Alert.alert('Upload Failed', e.message);
        }
    };

    const renderImageSlot = (
        label: string,
        imageUri: string | null,
        onPress: () => void,
        icon: keyof typeof Ionicons.glyphMap,
        color: string
    ) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Text style={styles.label}>{label}</Text>
                {imageUri && <Ionicons name="checkmark-circle" size={20} color="#10b981" />}
            </View>

            {imageUri ? (
                <View style={styles.imagePreviewContainer}>
                    <Image source={{ uri: imageUri }} style={styles.imagePreview} />
                    <TouchableOpacity style={styles.retakeBtn} onPress={onPress}>
                        <Ionicons name="camera-reverse" size={20} color="#fff" />
                        <Text style={styles.retakeText}>Retake</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <TouchableOpacity style={[styles.placeholderBtn, { borderColor: color }]} onPress={onPress}>
                    <Ionicons name={icon} size={32} color={color} />
                    <Text style={[styles.placeholderText, { color: color }]}>Capture {label}</Text>
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <SafeAreaView style={styles.container} edges={['bottom', 'left', 'right']}>
            <ScrollView contentContainerStyle={styles.content}>

                {/* 1. VIN Section */}
                <View style={styles.card}>
                    <Text style={styles.label}>1. Vehicle Identification (VIN)</Text>
                    <View style={styles.row}>
                        <View style={styles.inputWrapper}>
                            <TextInput
                                style={styles.input}
                                value={vin}
                                onChangeText={setVin}
                                placeholder="Enter VIN"
                                placeholderTextColor="#64748b"
                                autoCapitalize="characters"
                            />
                        </View>
                        <TouchableOpacity style={styles.scanBtn} onPress={() => openScanner('VIN')}>
                            <Ionicons name="barcode-outline" size={24} color="#fff" />
                        </TouchableOpacity>
                    </View>
                    {vinImage && (
                        <View style={styles.miniThumbContainer}>
                            <Image source={{ uri: vinImage }} style={styles.miniThumb} />
                            <Text style={styles.miniThumbText}>VIN Barcode Captured</Text>
                        </View>
                    )}
                </View>

                {/* 2. GPS Timestamp Section */}
                {renderImageSlot('2. GPS Timestamp', gpsImage, () => openScanner('GPS'), 'location', '#f59e0b')}

                {gpsData && (
                    <View style={styles.infoCard}>
                        <Ionicons name="information-circle-outline" size={20} color="#94a3b8" />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.infoText}>
                                {new Date(gpsData.time).toLocaleString()}
                            </Text>
                            <Text style={styles.subInfoText}>{address}</Text>
                        </View>
                    </View>
                )}

                {/* 3. Fault Photo Section */}
                {renderImageSlot('3. Fault Image', faultImage, () => openScanner('FAULT'), 'warning', '#ef4444')}

            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                    <Text style={styles.saveButtonText}>Complete Inspection</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    content: {
        padding: 20,
        gap: 20,
    },
    card: {
        backgroundColor: '#1e293b',
        borderRadius: 16,
        padding: 20,
        borderWidth: 1,
        borderColor: '#334155',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        color: '#94a3b8',
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    inputWrapper: {
        flex: 1,
        backgroundColor: '#0f172a',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#334155',
        justifyContent: 'center',
    },
    input: {
        color: '#fff',
        fontSize: 18,
        padding: 16,
        fontFamily: 'monospace',
    },
    scanBtn: {
        backgroundColor: '#3b82f6',
        width: 56,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    miniThumbContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        padding: 8,
        borderRadius: 8,
    },
    miniThumb: {
        width: 40,
        height: 40,
        borderRadius: 4,
        marginRight: 10,
    },
    miniThumbText: {
        color: '#3b82f6',
        fontSize: 12,
        fontWeight: '600',
    },
    placeholderBtn: {
        height: 140,
        borderWidth: 2,
        borderColor: '#334155',
        borderStyle: 'dashed',
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.02)',
        gap: 10,
    },
    placeholderText: {
        fontSize: 14,
        fontWeight: '600',
    },
    imagePreviewContainer: {
        height: 200,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    retakeBtn: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.7)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    retakeText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: 'rgba(148, 163, 184, 0.1)',
        padding: 12,
        borderRadius: 12,
        gap: 12,
        alignItems: 'center',
    },
    infoText: {
        color: '#e2e8f0',
        fontSize: 14,
        fontWeight: '600',
    },
    subInfoText: {
        color: '#94a3b8',
        fontSize: 12,
    },
    footer: {
        padding: 20,
        backgroundColor: '#1e293b',
        borderTopWidth: 1,
        borderTopColor: '#334155',
    },
    saveButton: {
        backgroundColor: '#10b981',
        padding: 18,
        borderRadius: 16,
        alignItems: 'center',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    saveButtonText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: 'bold',
    },
});
