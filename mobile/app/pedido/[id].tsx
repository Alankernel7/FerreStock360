import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../../src/components/AppHeader";
import PrimaryButton from "../../src/components/PrimaryButton";
import { colors } from "../../src/constants/colors";
import { espaciado, radio, tipografia } from "../../src/constants/theme";
import { obtenerPedido, type Pedido } from "../../src/services/operaciones";

const dinero = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function PedidoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [pedido, setPedido] = useState<Pedido | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    const idPedido = Number(id);
    if (!Number.isSafeInteger(idPedido) || idPedido < 1) {
      setError("El número del pedido no es válido.");
      setCargando(false);
      return;
    }
    try { setPedido(await obtenerPedido(idPedido)); setError(""); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo cargar el pedido."); }
    finally { setCargando(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  return (
    <View style={styles.pantalla}>
      <AppHeader onVolver={() => router.replace("/compras")} />
      {cargando ? <ActivityIndicator color={colors.yellowDark} size="large" style={{ flex: 1 }} /> : error ? (
        <View style={styles.contenido}><Text style={styles.error}>{error}</Text><PrimaryButton titulo="Mis pedidos" onPress={() => router.replace("/compras")} /></View>
      ) : pedido ? (
        <ScrollView contentContainerStyle={styles.contenido}>
          <View style={styles.exito}><Ionicons name={pedido.estado_pago === "rechazado" || pedido.estado_pedido === "rechazado" ? "alert-circle" : "checkmark-circle"} size={54} color={pedido.estado_pago === "rechazado" || pedido.estado_pedido === "rechazado" ? colors.danger : colors.exitoTexto} />
            <Text style={styles.titulo}>{pedido.estado_pago === "rechazado" || pedido.estado_pedido === "rechazado" ? "Pago rechazado" : "Pedido registrado"}</Text>
            <Text style={styles.mensaje}>{pedido.mensaje || (pedido.metodo_pago === "efectivo" ? "Tu reserva está confirmada. El pago queda pendiente hasta el retiro." : "La compra fue procesada.")}</Text>
          </View>
          <View style={styles.tarjeta}>
            <Text style={styles.seccion}>Pedido {pedido.codigo_pedido}</Text>
            <Fila etiqueta="Estado" valor={pedido.estado_pedido} />
            <Fila etiqueta="Pago" valor={`${pedido.estado_pago || "pendiente"}${pedido.metodo_pago ? ` · ${pedido.metodo_pago}` : ""}`} />
            <Fila etiqueta="Fecha de retiro" valor={pedido.fecha_retiro || "—"} />
            {pedido.detalles?.map((item) => <Fila key={item.id_producto} etiqueta={`${item.nombre} × ${item.cantidad}`} valor={dinero(item.subtotal)} />)}
            <Fila etiqueta="Total" valor={dinero(pedido.total)} fuerte />
          </View>
          <PrimaryButton titulo="Ir a mis pedidos" icono="receipt-outline" onPress={() => router.replace("/compras")} />
          <PrimaryButton titulo="Seguir comprando" variante="contorno" icono="grid-outline" onPress={() => router.replace("/catalogo")} />
        </ScrollView>
      ) : null}
    </View>
  );
}

function Fila({ etiqueta, valor, fuerte = false }: { etiqueta: string; valor: string; fuerte?: boolean }) {
  return <View style={styles.fila}><Text style={[styles.etiqueta, fuerte && styles.fuerte]}>{etiqueta}</Text><Text style={[styles.valor, fuerte && styles.fuerte]}>{valor}</Text></View>;
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.light }, contenido: { padding: espaciado.lg, gap: espaciado.md, flexGrow: 1, justifyContent: "center" },
  exito: { backgroundColor: colors.white, borderRadius: radio.md, padding: espaciado.xl, alignItems: "center", gap: espaciado.sm }, titulo: { color: colors.black, fontSize: tipografia.xxl, fontWeight: "800", textAlign: "center" }, mensaje: { color: colors.textoSecundario, textAlign: "center", lineHeight: 21 },
  tarjeta: { backgroundColor: colors.white, borderRadius: radio.md, padding: espaciado.lg, gap: espaciado.md }, seccion: { color: colors.black, fontSize: tipografia.lg, fontWeight: "800" }, fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: espaciado.md }, etiqueta: { flex: 1, color: colors.textoSecundario }, valor: { flex: 1, color: colors.black, textAlign: "right" }, fuerte: { color: colors.black, fontWeight: "800" }, error: { color: colors.errorTexto, marginBottom: espaciado.md },
});
