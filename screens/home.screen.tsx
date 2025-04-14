import {
  Alert,
  Image,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Button,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { LinearGradient } from "expo-linear-gradient";
import { scale, verticalScale } from "react-native-size-matters";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Audio } from "expo-av";
import axios from "axios";
import LottieView from "lottie-react-native";
import * as Speech from "expo-speech";

export default function HomeScreen() {
  const [text, setText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState<Audio.Recording>();
  const [AIResponse, setAIResponse] = useState(false);
  const [AISpeaking, setAISpeaking] = useState(false);
  const lottieRef = useRef<LottieView>(null);
  const [responseText, setResponseText] = useState("");

  const [recordedAudio, setRecordedAudio] = useState("");

  const [sound, setSound] = useState<Audio.Sound | null>(null);

  const playAudio = async () => {
    try {
      const { sound } = await Audio.Sound.createAsync(
        { uri: recordedAudio }, // Replace with your local or online audio URI
        { shouldPlay: true }
      );
      setSound(sound);
    } catch (error) {
      console.log("Error loading audio", error);
    }
  };

  const YOUR_WIT_AI_ACCESS_TOKEN = `6KVLBUYLPAJQGJAS2KLGFR74N3VGWZLP`;

  const getMicrophonePermission = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert("Permission", "Please grant microphone access");
        return false;
      }
      return true;
    } catch (error) {
      console.log(error);
      return false;
    }
  };

  const recordingOptions = {
    android: {
      extension: ".wav",
      outputFormat: Audio.AndroidOutputFormat.THREE_GPP, // PCM 16-bit
      androidEncoder: Audio.AndroidAudioEncoder.AMR_NB, 
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 128000,
    },
    ios: {
      extension: ".wav",
      audioQuality: Audio.IOSAudioQuality.HIGH,
      sampleRate: 16000,
      numberOfChannels: 1,
      bitRate: 128000,
      linearPCMBitDepth: 16,
      linearPCMIsBigEndian: false,
      linearPCMIsFloat: false,
    },
    web: {
      mimeType: "audio/wav",
      bitsPerSecond: 128000,
    },
  };

  const startRecording = async () => {
    const hasPermission = await getMicrophonePermission();
    if (!hasPermission) return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      setIsRecording(true);
      const { recording } = await Audio.Recording.createAsync(recordingOptions);
      setRecording(recording);
    } catch (error) {
      console.log("Failed to start Recording", error);
      Alert.alert("Error", "Failed to start recording");
    }
  };

  const stopRecording = async () => {
    try {
      setIsRecording(false);
      setLoading(true);
      await recording?.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
      });

      const uri = recording?.getURI();
      setRecordedAudio(uri);
      
      console.log(uri);
      if (!uri) return;

      // Send audio to Wit.ai for transcription and intent detection
      await sendAudioToWitAI(uri);
    } catch (error) {
      console.log("Failed to stop Recording", error);
      Alert.alert("Error", "Failed to stop recording");
    }
  };

  const sendAudioToWitAI = async (uri: string) => {
    try {
      const response = await fetch(uri);
      const audioBlob = await response.blob(); // Get audio as Blob

      const witResponse = await fetch("https://api.wit.ai/speech?v=20230215", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${YOUR_WIT_AI_ACCESS_TOKEN}`,
          'Content-Type': 'audio/wav',
        },
        body: audioBlob,
      });

      // ✅ Check if response is JSON
      const contentType = witResponse.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        throw new Error("Invalid response from Wit.ai. Expected JSON.");
      }

      const data = await witResponse.json();
      console.log("Wit.ai Response:", data);
      setLoading(false);

      const transcript = data.text || "Could not understand audio";
      setText(transcript);
      await speakText(transcript);
    } catch (error) {
      console.log("Error sending audio to Wit.ai:", error);
    }
  };

  const speakText = async (text: string) => {
    setAISpeaking(true);
    const options = {
      language: "en-US",
      pitch: 1.5,
      rate: 1,
      onDone: () => {
        setAISpeaking(false);
      },
    };
    Speech.speak(text, options);
  };

  useEffect(() => {
    if (AISpeaking) {
      lottieRef.current?.play();
    } else {
      lottieRef.current?.reset();
    }
  }, [AISpeaking]);

  return (
    <LinearGradient
      colors={["#250152", "#000"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.container}
    >
      <StatusBar barStyle={"light-content"} />

      <View style={{ marginTop: verticalScale(-40) }}>
        {loading ? (
          <TouchableOpacity>
            <LottieView
              source={require("@/assets/animations/loading.json")}
              autoPlay
              loop
              speed={1.3}
              style={{ width: scale(270), height: scale(270) }}
            />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={{
              width: scale(110),
              height: scale(110),
              backgroundColor: "#fff",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: scale(100),
            }}
            onPress={isRecording ? stopRecording : startRecording}
          >
            <FontAwesome
              name={isRecording ? "stop" : "microphone"}
              size={scale(50)}
              color="#2b3356"
            />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.textContainer}>
        <Text style={styles.text}>
          {loading ? "..." : text || "Press the microphone to start recording!"}
        </Text>
        <View style={{ paddingTop: 200 }}>
          <Button title="Play Audio" onPress={playAudio} ></Button>;
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center" },
  textContainer: { alignItems: "center", position: "absolute", bottom: 90 },
  text: { color: "#fff", fontSize: 16, textAlign: "center", lineHeight: 25 },
});
