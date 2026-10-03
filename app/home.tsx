import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { authStore } from './authStore';
import { inspectionStore } from './inspectionStore';

import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { FlatList, Image, RefreshControl } from 'react-native';
import { API_URL, getInspections } from './services/api';

export default function HomeScreen() {
    const router = useRouter();
    const [inspections, setInspections] = useState<any[]>([]);
    const [refreshing, setRefreshing] = useState(false);

    const handleStart = () => {
        inspectionStore.reset();
        router.push('/details');
    };

    const handleLogout = () => {
        authStore.clearSession();
        router.replace('/');
    };

    const loadData = async () => {
        try {
            if (authStore.token) {
                const data = await getInspections(authStore.token);
                setInspections(data.reverse()); // Show newest first
            }
        } catch (e) {
            console.log(e);
        }
    };

    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const onRefresh = async () => {
        setRefreshing(true);
        await loadData();
        setRefreshing(false);
    };

    const getImg = (path: string) => path ? `${API_URL.replace('/api', '')}/${path.replace(/\\/g, '/')}` : null;

    return (
        <SafeAreaView style={styles.container}>
            <StatusBar style="light" />
            <View style={styles.header}>
                <View>
                    <Text style={styles.headerTitle}>VIN Inspector</Text>
                    <Text style={styles.headerSubtitle}>Welcome, {authStore.mechanicName || 'Mechanic'}</Text>
                </View>
                <TouchableOpacity onPress={handleLogout}>
                    <Ionicons name="log-out-outline" size={24} color="#94a3b8" />
                </TouchableOpacity>
            </View>

            <View style={styles.content}>
                <View style={styles.illustration}>
                    <Ionicons name="car-sport" size={120} color="#3b82f6" />
                    <View style={styles.circleBg} />
                </View>

                <TouchableOpacity
                    style={styles.startButton}
                    onPress={handleStart}
                    activeOpacity={0.8}
                >
                    <View style={styles.iconCircle}>
                        <Ionicons name="scan" size={32} color="#3b82f6" />
                    </View>
                    <View style={styles.btnTextContainer}>
                        <Text style={styles.btnTitle}>Start New Inspection</Text>
                        <Text style={styles.btnSubtitle}>Capture VIN, GPS & Faults</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={24} color="#fff" style={{ opacity: 0.5 }} />
                </TouchableOpacity>

                <View style={styles.recentSection}>
                    <Text style={styles.sectionTitle}>Recent Inspections</Text>
                    {inspections.length === 0 ? (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyText}>No recent inspections</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={inspections}
                            keyExtractor={item => item.id.toString()}
                            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />}
                            renderItem={({ item }) => (
                                <View style={styles.inspItem}>
                                    <View style={styles.inspInfo}>
                                        <Text style={styles.inspVin}>{item.vin}</Text>
                                        <Text style={styles.inspDate}>{new Date(item.createdAt).toLocaleDateString()}</Text>
                                    </View>
                                    <View style={styles.inspThumbs}>
                                        {item.vinImage && <Image source={{ uri: getImg(item.vinImage) as string }} style={styles.thumb} />}
                                        {item.faultImage && <Image source={{ uri: getImg(item.faultImage) as string }} style={styles.thumb} />}
                                    </View>
                                </View>
                            )}
                            style={{ maxHeight: 300 }}
                        />
                    )}
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 20,
        marginBottom: 40,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    headerTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
    },
    headerSubtitle: {
        fontSize: 16,
        color: '#94a3b8',
        marginTop: 8,
    },
    content: {
        flex: 1,
        paddingHorizontal: 24,
    },
    illustration: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 60,
        position: 'relative',
    },
    circleBg: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        zIndex: -1,
    },
    startButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#3b82f6',
        borderRadius: 24,
        padding: 20,
        shadowColor: '#3b82f6',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    iconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    btnTextContainer: {
        flex: 1,
    },
    btnTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
    },
    btnSubtitle: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.9)',
        marginTop: 2,
    },
    recentSection: {
        marginTop: 60,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#94a3b8',
        marginBottom: 16,
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    emptyState: {
        padding: 24,
        backgroundColor: '#1e293b',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#334155',
        alignItems: 'center',
    },
    emptyText: {
        color: '#64748b',
    },
    inspItem: {
        backgroundColor: '#1e293b',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#334155',
    },
    inspInfo: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    inspVin: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    inspDate: {
        color: '#94a3b8',
        fontSize: 12,
    },
    inspThumbs: {
        flexDirection: 'row',
        gap: 8,
    },
    thumb: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#334155',
    },
});
