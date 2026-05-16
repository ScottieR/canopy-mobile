import { StyleSheet, Button, View, Text as RNText } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useDispatch, PairingData } from '../../context/DispatchContext';
import { router } from 'expo-router';
import { useState } from 'react';

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const { connect } = useDispatch();
  const [scanned, setScanned] = useState(false);

  if (!permission) {
    return <View />;
  }

  if (!permission.granted) {
    return (
      <View style={styles.container}>
        <RNText style={{ color: 'white', marginBottom: 20 }}>We need your permission to show the camera</RNText>
        <Button onPress={requestPermission} title="grant permission" />
      </View>
    );
  }

  const handleBarCodeScanned = ({ type, data }: { type: string, data: string }) => {
    setScanned(true);
    try {
      const parsedData: PairingData = JSON.parse(data);
      if (parsedData.token && parsedData.ip && parsedData.port) {
        connect(parsedData);
        router.replace('/(tabs)');
      } else {
        alert('Invalid QR code format');
        setTimeout(() => setScanned(false), 2000);
      }
    } catch (e) {
      alert('Invalid QR code');
      setTimeout(() => setScanned(false), 2000);
    }
  };

  return (
    <View style={styles.container}>
      <CameraView 
        style={StyleSheet.absoluteFillObject} 
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />
      <View style={styles.overlay}>
        <View style={styles.scanBox} />
        <RNText style={styles.text}>Scan the Canopy Desktop QR Code</RNText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: '#000',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanBox: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#218380',
    backgroundColor: 'transparent',
    marginBottom: 40,
    borderRadius: 20,
  },
  text: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 10,
    borderRadius: 8,
  }
});
