import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Mode = 'VIN' | 'GPS' | 'FAULT';

import { inspectionStore } from './inspectionStore';

export default function ScanScreen() {
    const router = useRouter();
    const params = useLocalSearchParams();
    const mode = (params.mode as Mode) || 'VIN';

    const [permission, requestPermission] = useCameraPermissions();
    const [isScanning, setIsScanning] = useState(false);
    const [location, setLocation] = useState<Location.LocationObject | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const cameraRef = useRef<CameraView>(null);

    useEffect(() => {
        if (permission && !permission.granted) {
            requestPermission();
        }
    }, [permission]);

    // GPS Mode: Watch location and time
    useEffect(() => {
        if (mode === 'GPS') {
            const timer = setInterval(() => setCurrentTime(new Date()), 1000);

            let sub: Location.LocationSubscription | null = null;
            (async () => {
                const { status } = await Location.requestForegroundPermissionsAsync();
                if (status === 'granted') {
                    sub = await Location.watchPositionAsync(
                        { accuracy: Location.Accuracy.High, timeInterval: 5000, distanceInterval: 10 },
                        (loc) => setLocation(loc)
                    );
                }
            })();

            return () => {
                clearInterval(timer);
                if (sub) sub.remove();
            };
        }
    }, [mode]);

    if (!permission) return <View style={styles.container} />;

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.message}>We need your permission to show the camera</Text>
                <TouchableOpacity style={styles.button} onPress={requestPermission}>
                    <Text style={styles.buttonText}>Grant Permission</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const handleCapture = async () => {
        if (cameraRef.current) {
            setIsScanning(true);
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.8,
                    base64: true,
                });

                // Mock OCR simulation
                let extractedVin = '';
                if (mode === 'VIN') {
                    await new Promise(r => setTimeout(r, 1000));
                    extractedVin = "1HGCM82633A004352";
                }

                setIsScanning(false);

                // Update Store directly
                const updates: any = {
                    [`${mode.toLowerCase()}Image`]: photo.uri
                };

                if (extractedVin) {
                    updates.vin = extractedVin;
                }

                if (mode === 'GPS' && location) {
                    updates.gpsData = {
                        lat: location.coords.latitude,
                        long: location.coords.longitude,
                        time: currentTime.toISOString()
                    };
                }

                inspectionStore.update(updates);

                // Return to existing Details screen
                router.back();

            } catch (error) {
                console.error(error);
                setIsScanning(false);
                Alert.alert('Error', 'Failed to take photo');
            }
        }
    };

    const getTitle = () => {
        switch (mode) {
            case 'VIN': return 'Scan VIN Barcode';
            case 'GPS': return 'Capture GPS Context';
            case 'FAULT': return 'Capture Fault';
            default: return 'Camera';
        }
    };

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                facing="back"
                ref={cameraRef}
            >
                <SafeAreaView style={styles.overlay}>

                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={() => router.back()} style={styles.closeButton}>
                            <Ionicons name="close" size={28} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.headerText}>{getTitle()}</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Middle Overlay Content */}
                    <View style={styles.middleContent}>

                        {/* VIN Overlay */}
                        {mode === 'VIN' && (
                            <View style={styles.scanArea}>
                                <View style={styles.scanFrame} />
                                <Text style={styles.scanHint}>Align VIN within frame</Text>
                            </View>
                        )}

                        {/* GPS Overlay */}
                        {mode === 'GPS' && (
                            <View style={styles.gpsOverlay}>
                                <View style={styles.gpsBadge}>
                                    <Text style={styles.gpsTime}>
                                        {currentTime.toLocaleTimeString()}
                                    </Text>
                                    <Text style={styles.gpsDate}>
                                        {currentTime.toLocaleDateString()}
                                    </Text>
                                    <View style={styles.gpsDivider} />
                                    {location ? (
                                        <Text style={styles.gpsCoords}>
                                            {location.coords.latitude.toFixed(6)}, {location.coords.longitude.toFixed(6)}
                                        </Text>
                                    ) : (
                                        <ActivityIndicator size="small" color="#fff" />
                                    )}
                                    <Text style={styles.gpsLabel}>VERIFIED LOCATION</Text>
                                </View>
                            </View>
                        )}

                    </View>

                    {/* Controls */}
                    <View style={styles.controls}>
                        <TouchableOpacity
                            style={styles.captureButton}
                            onPress={handleCapture}
                            disabled={isScanning}
                        >
                            {isScanning ? (
                                <ActivityIndicator color="#0f172a" size="large" />
                            ) : (
                                <View style={styles.innerCapture} />
                            )}
                        </TouchableOpacity>
                    </View>
                </SafeAreaView>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#000',
    },
    camera: {
        flex: 1,
    },
    message: {
        textAlign: 'center',
        paddingBottom: 10,
        color: '#fff',
    },
    button: {
        padding: 20,
        backgroundColor: '#3b82f6',
        borderRadius: 10,
    },
    buttonText: {
        color: '#fff',
        fontWeight: 'bold',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.1)',
        justifyContent: 'space-between',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingTop: 20,
        backgroundColor: 'rgba(0,0,0,0.4)',
        paddingBottom: 20,
    },
    closeButton: {
        padding: 8,
        backgroundColor: 'rgba(0,0,0,0.5)',
        borderRadius: 20,
    },
    headerText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        textShadowColor: 'rgba(0,0,0,0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    middleContent: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // VIN Styles
    scanArea: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    scanFrame: {
        width: '80%',
        height: 100,
        borderWidth: 2,
        borderColor: '#3b82f6',
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    scanHint: {
        color: '#fff',
        marginTop: 16,
        fontSize: 14,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        overflow: 'hidden',
    },
    // GPS Styles
    gpsOverlay: {
        position: 'absolute',
        bottom: 40,
        left: 20,
    },
    gpsBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        padding: 16,
        borderRadius: 12,
        borderLeftWidth: 4,
        borderLeftColor: '#ef4444', // Red accent
        alignItems: 'flex-start',
    },
    gpsTime: {
        color: '#fff',
        fontSize: 28,
        fontWeight: '800',
        fontVariant: ['tabular-nums'],
    },
    gpsDate: {
        color: '#e2e8f0',
        fontSize: 14,
        marginBottom: 8,
    },
    gpsDivider: {
        height: 1,
        width: '100%',
        backgroundColor: 'rgba(255,255,255,0.2)',
        marginBottom: 8,
    },
    gpsCoords: {
        color: '#fff',
        fontSize: 14,
        fontFamily: 'monospace',
        fontWeight: '600',
    },
    gpsLabel: {
        color: '#ef4444',
        fontSize: 10,
        letterSpacing: 1,
        marginTop: 4,
        fontWeight: 'bold',
    },
    controls: {
        flexDirection: 'row',
        justifyContent: 'center',
        paddingBottom: 50,
    },
    captureButton: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(255,255,255,0.3)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 4,
        borderColor: '#fff',
    },
    innerCapture: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: '#fff',
    },
});
