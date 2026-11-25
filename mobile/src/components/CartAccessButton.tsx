import { useCallback, useState } from "react";
import { DeviceEventEmitter, Pressable, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../constants/colors";
import { useAuth } from "../contexts/AuthContext";
import { apiConfigurada, obtenerCarritoMovil } from "../services/operaciones";

export default function CartAccessButton() {
  const { usuario } = useAuth();
  const [cantidad, setCantidad] = useState(0);

  const actualizar = useCallback(async () => {
    if (!usuario || !apiConfigurada) {
      setCantidad(0);
      return;
    }
    try {
      const items = await obtenerCarritoMovil();
      setCantidad(items.reduce((total, item) => total + item.cantidad, 0));
    } catch {
      // El botón sigue disponible aunque el backend esté temporalmente fuera de línea.
    }
  }, [usuario?.uid]);

  useFocusEffect(useCallback(() => {
    void actualizar();
    const subscription = DeviceEventEmitter.addListener("carrito:actualizado", () => void actualizar());
    return () => subscription.remove();
  }, [actualizar]));

  return (
    <Pressable
      onPress={() => router.push(usuario ? "/compras" : "/login")}
      accessibilityRole="button"
      accessibilityLabel={`Abrir carrito, ${cantidad} artículos`}
      style={styles.boton}
    >
      <Ionicons name="cart-outline" size={22} color={colors.white} />
      {cantidad > 0 && (
        <View style={styles.insignia}>
          <Text style={styles.insigniaTexto}>{cantidad > 99 ? "99+" : cantidad}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  boton: { width: 40, height: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: colors.dark },
  insignia: { position: "absolute", top: -3, right: -5, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 999, backgroundColor: colors.yellow, alignItems: "center", justifyContent: "center" },
  insigniaTexto: { color: colors.black, fontSize: 10, fontWeight: "800" },
});
