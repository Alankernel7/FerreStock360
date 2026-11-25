import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../src/components/AppHeader";
import PrimaryButton from "../src/components/PrimaryButton";
import { colors } from "../src/constants/colors";
import { espaciado, radio, tipografia } from "../src/constants/theme";
import { useAuth } from "../src/contexts/AuthContext";
import { cargarCompras, confirmarRetiro, type Item } from "../src/services/operaciones";

const CLAVE_CHECKOUT = "ferrestock_checkout_key";
const dinero = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function CheckoutScreen() {
  const { usuario } = useAuth();
  const [items, setItems] = useState<Item[]>([]);
  const [fechas, setFechas] = useState<string[]>([]);
  const [fecha, setFecha] = useState("");
  const [metodo, setMetodo] = useState<"efectivo" | "tarjeta">("efectivo");
  const [tarjeta, setTarjeta] = useState({ numero: "", vencimiento: "", cvv: "" });
  const [cargando, setCargando] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState("");
  const subtotal = items.reduce((sum, item) => sum + item.cantidad * item.precio, 0);

  const cargar = useCallback(async () => {
    setError("");
    try {
      const datos = await cargarCompras();
      setItems(datos.items);
      setFechas(datos.fechas);
      setFecha((actual) => datos.fechas.includes(actual) ? actual : (datos.fechas[0] ?? ""));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar el resumen de compra.");
    } finally { setCargando(false); }
  }, []);
  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  const confirmar = async () => {
    if (!items.length) { setError("Agrega al menos un producto antes de confirmar."); return; }
    if (!fecha) { setError("Selecciona una fecha de retiro disponible."); return; }
    if (metodo === "tarjeta" && (!tarjeta.numero.trim() || !tarjeta.vencimiento.trim() || !tarjeta.cvv.trim())) {
      setError("Completa los datos de la tarjeta de demostración.");
      return;
    }
    setProcesando(true);
    setError("");
    try {
      const clave = await AsyncStorage.getItem(CLAVE_CHECKOUT) || randomUUID();
      await AsyncStorage.setItem(CLAVE_CHECKOUT, clave);
      const pedido = await confirmarRetiro(fecha, clave, metodo === "tarjeta" ? tarjeta : undefined);
      await AsyncStorage.removeItem(CLAVE_CHECKOUT);
      setTarjeta({ numero: "", vencimiento: "", cvv: "" });
      router.replace(`/pedido/${pedido.id_pedido}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar el pedido.");
    } finally { setProcesando(false); }
  };

  return (
    <View style={styles.pantalla}>
      <AppHeader onVolver={() => router.back()} />
      <ScrollView contentContainerStyle={styles.contenido} keyboardShouldPersistTaps="handled">
        <Text style={styles.titulo}>Finalizar compra</Text>
        {cargando ? <ActivityIndicator color={colors.yellowDark} size="large" style={{ padding: 40 }} /> : !items.length ? (
          <View style={styles.tarjeta}><Text style={styles.seccion}>Tu carrito está vacío</Text><PrimaryButton titulo="Volver al carrito" onPress={() => router.replace("/compras")} /></View>
        ) : <>
          <View style={styles.tarjeta}>
            <Text style={styles.seccion}>Datos del cliente</Text>
            <View style={styles.dato}><Text style={styles.etiqueta}>Nombre</Text><Text style={styles.valor}>{usuario?.nombre || "—"}</Text></View>
            <View style={styles.dato}><Text style={styles.etiqueta}>Correo</Text><Text style={styles.valor}>{usuario?.email || "—"}</Text></View>
          </View>

          <View style={styles.tarjeta}>
            <Text style={styles.seccion}>Fecha de retiro</Text>
            <Text style={styles.ayuda}>Selecciona una fecha disponible en la tienda.</Text>
            {fechas.map((opcion) => <Pressable key={opcion} onPress={() => setFecha(opcion)} style={[styles.opcion, fecha === opcion && styles.opcionActiva]}>
              <Ionicons name={fecha === opcion ? "radio-button-on" : "radio-button-off"} size={20} color={fecha === opcion ? colors.yellowDark : colors.gray} />
              <Text style={styles.valor}>{new Intl.DateTimeFormat("es-SV", { dateStyle: "full", timeZone: "UTC" }).format(new Date(opcion + "T12:00:00Z"))}</Text>
            </Pressable>)}
            {!fechas.length && <Text style={styles.errorTexto}>No hay fechas de retiro disponibles.</Text>}
          </View>

          <View style={styles.tarjeta}>
            <Text style={styles.seccion}>Método de pago</Text>
            {([ ["efectivo", "Efectivo", "Pagarás en el establecimiento al retirar el pedido."], ["tarjeta", "Tarjeta simulada", "Pago de demostración para uso académico." ]] as const).map(([valor, etiqueta, ayuda]) => (
              <Pressable key={valor} onPress={() => setMetodo(valor)} style={[styles.opcion, metodo === valor && styles.opcionActiva]}>
                <Ionicons name={metodo === valor ? "radio-button-on" : "radio-button-off"} size={20} color={metodo === valor ? colors.yellowDark : colors.gray} />
                <View style={{ flex: 1 }}><Text style={styles.valor}>{etiqueta}</Text><Text style={styles.ayuda}>{ayuda}</Text></View>
              </Pressable>
            ))}
            {metodo === "tarjeta" && <View style={styles.formTarjeta}>
              <Text style={styles.aviso}>Usa únicamente datos ficticios. No ingreses una tarjeta real. El backend aprueba tarjetas de prueba válidas cuyo último dígito sea par.</Text>
              <TextInput accessibilityLabel="Número de tarjeta de demostración" value={tarjeta.numero} onChangeText={(numero) => setTarjeta((actual) => ({ ...actual, numero }))} keyboardType="number-pad" maxLength={23} placeholder="4242 4242 4242 4242" style={styles.input} />
              <View style={styles.filaInputs}>
                <TextInput accessibilityLabel="Vencimiento" value={tarjeta.vencimiento} onChangeText={(vencimiento) => setTarjeta((actual) => ({ ...actual, vencimiento }))} maxLength={5} placeholder="MM/AA" style={[styles.input, styles.inputMitad]} />
                <TextInput accessibilityLabel="CVV de prueba" value={tarjeta.cvv} onChangeText={(cvv) => setTarjeta((actual) => ({ ...actual, cvv }))} keyboardType="number-pad" secureTextEntry maxLength={4} placeholder="CVV" style={[styles.input, styles.inputMitad]} />
              </View>
            </View>}
          </View>

          <View style={styles.tarjeta}>
            <Text style={styles.seccion}>Resumen</Text>
            {items.map((item) => <View key={item.id_producto} style={styles.filaResumen}><Text style={styles.productoResumen}>{item.nombre} · {item.cantidad} × {dinero(item.precio)}</Text><Text style={styles.valor}>{dinero(item.cantidad * item.precio)}</Text></View>)}
            <View style={[styles.filaResumen, styles.totalFila]}><Text style={styles.seccion}>Total</Text><Text style={styles.total}>{dinero(subtotal)}</Text></View>
            <Text style={styles.ayuda}>Precios y existencias se comprobarán nuevamente antes de registrar el pedido.</Text>
          </View>
          {!!error && <View style={styles.error}><Text style={styles.errorTexto}>{error}</Text></View>}
          <PrimaryButton titulo={procesando ? "Procesando…" : "Confirmar pedido"} icono="checkmark-circle-outline" cargando={procesando} deshabilitado={procesando || !fecha} onPress={() => void confirmar()} />
        </>}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.light }, contenido: { padding: espaciado.lg, paddingBottom: 36, gap: espaciado.md },
  titulo: { color: colors.black, fontSize: tipografia.xxl, fontWeight: "800", marginBottom: espaciado.sm },
  tarjeta: { backgroundColor: colors.white, borderRadius: radio.md, padding: espaciado.lg, gap: espaciado.md },
  seccion: { color: colors.black, fontSize: tipografia.lg, fontWeight: "800" }, dato: { gap: 3 }, etiqueta: { color: colors.textoSuave, fontSize: tipografia.xs }, valor: { color: colors.black, fontWeight: "600" },
  ayuda: { color: colors.textoSecundario, fontSize: tipografia.xs, lineHeight: 18 }, opcion: { borderWidth: 1, borderColor: colors.borde, borderRadius: radio.sm, padding: espaciado.md, flexDirection: "row", alignItems: "center", gap: espaciado.sm }, opcionActiva: { borderColor: colors.yellowDark, backgroundColor: "#FFFBEB" },
  formTarjeta: { gap: espaciado.sm, backgroundColor: "#EFF6FF", padding: espaciado.md, borderRadius: radio.sm }, aviso: { color: "#1E40AF", fontSize: tipografia.xs, lineHeight: 17 }, input: { borderWidth: 1, borderColor: colors.borde, backgroundColor: colors.white, borderRadius: radio.sm, paddingHorizontal: espaciado.md, paddingVertical: 12, color: colors.black }, filaInputs: { flexDirection: "row", gap: espaciado.sm }, inputMitad: { flex: 1 },
  filaResumen: { flexDirection: "row", justifyContent: "space-between", gap: espaciado.sm, alignItems: "center" }, productoResumen: { flex: 1, color: colors.textoSecundario, fontSize: tipografia.sm }, totalFila: { borderTopWidth: 1, borderTopColor: colors.bordeClaro, paddingTop: espaciado.md }, total: { color: colors.black, fontWeight: "800", fontSize: tipografia.lg }, error: { backgroundColor: colors.errorBg, borderColor: colors.errorBorde, borderWidth: 1, borderRadius: radio.sm, padding: espaciado.md }, errorTexto: { color: colors.errorTexto },
});
