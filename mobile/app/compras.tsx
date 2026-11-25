import { useCallback, useState } from "react";
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AppHeader from "../src/components/AppHeader";
import PrimaryButton from "../src/components/PrimaryButton";
import { colors } from "../src/constants/colors";
import { espaciado, radio, tipografia } from "../src/constants/theme";
import { cargarCompras, guardarCantidad, quitarProducto, type Item, type Pedido } from "../src/services/operaciones";

const dinero = (n: number) => `$${Number(n || 0).toFixed(2)}`;

export default function Compras() {
  const [items, setItems] = useState<Item[]>([]);
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [ocupado, setOcupado] = useState<number | null>(null);
  const [error, setError] = useState("");
  const subtotal = items.reduce((sum, item) => sum + item.cantidad * item.precio, 0);

  const cargar = useCallback(async () => {
    setError("");
    try {
      const datos = await cargarCompras();
      setItems(datos.items);
      setPedidos(datos.pedidos);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo cargar tu carrito.");
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void cargar(); }, [cargar]));

  const cambiarCantidad = async (item: Item, cantidad: number) => {
    if (ocupado !== null) return;
    if (cantidad > (item.maximo_carrito ?? Number.MAX_SAFE_INTEGER)) {
      setError("La cantidad supera las existencias disponibles.");
      return;
    }
    setOcupado(item.id_producto);
    setError("");
    try {
      const actualizados = await guardarCantidad(item.id_producto, cantidad);
      setItems(actualizados);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar la cantidad.");
    } finally {
      setOcupado(null);
    }
  };

  const eliminar = async (id: number) => {
    if (ocupado !== null) return;
    setOcupado(id);
    setError("");
    try { setItems(await quitarProducto(id)); }
    catch (e) { setError(e instanceof Error ? e.message : "No se pudo quitar el producto."); }
    finally { setOcupado(null); }
  };

  return (
    <View style={styles.pantalla}>
      <AppHeader onVolver={() => router.back()} />
      <ScrollView contentContainerStyle={styles.contenido}>
        <View style={styles.cabecera}>
          <View><Text style={styles.titulo}>Mi carrito</Text><Text style={styles.subtitulo}>Productos reservados en tu cuenta</Text></View>
          <Pressable onPress={() => void cargar()} accessibilityLabel="Actualizar carrito" style={styles.actualizar}>
            <Ionicons name="refresh" size={20} color={colors.black} />
          </Pressable>
        </View>

        {!!error && <View style={styles.error}><Text style={styles.errorTexto}>{error}</Text></View>}
        {cargando ? <ActivityIndicator color={colors.yellowDark} size="large" style={styles.carga} /> : items.length === 0 ? (
          <View style={styles.vacio}>
            <Ionicons name="cart-outline" size={42} color={colors.gray} />
            <Text style={styles.vacioTitulo}>Tu carrito está vacío</Text>
            <Text style={styles.subtitulo}>Explora el catálogo y agrega productos para comenzar tu compra.</Text>
            <PrimaryButton titulo="Ver catálogo" icono="grid-outline" onPress={() => router.push("/catalogo")} estilo={styles.botonLargo} />
          </View>
        ) : (
          <>
            {items.map((item) => (
              <View key={item.id_producto} style={styles.producto}>
                {item.imagen ? <Image source={{ uri: item.imagen }} style={styles.imagen} resizeMode="contain" /> : <View style={[styles.imagen, styles.imagenVacia]}><Ionicons name="cube-outline" size={28} color={colors.gray} /></View>}
                <View style={styles.detalle}>
                  <Text style={styles.nombre} numberOfLines={2}>{item.nombre}</Text>
                  <Text style={styles.precio}>{dinero(item.precio)} por unidad</Text>
                  <Text style={styles.stock}>{item.estado_reserva === "activa" ? "Unidades reservadas" : `${item.stock_disponible ?? 0} disponibles`}</Text>
                  <View style={styles.filaProducto}>
                    <View style={styles.cantidad}>
                      <Pressable accessibilityLabel="Disminuir cantidad" disabled={ocupado !== null || item.cantidad <= 1} onPress={() => void cambiarCantidad(item, item.cantidad - 1)} style={styles.botonCantidad}><Ionicons name="remove" size={18} color={item.cantidad <= 1 ? colors.textoSuave : colors.black} /></Pressable>
                      {ocupado === item.id_producto ? <ActivityIndicator size="small" color={colors.yellowDark} /> : <Text style={styles.cantidadTexto}>{item.cantidad}</Text>}
                      <Pressable accessibilityLabel="Aumentar cantidad" disabled={ocupado !== null || item.cantidad >= (item.maximo_carrito ?? Number.MAX_SAFE_INTEGER)} onPress={() => void cambiarCantidad(item, item.cantidad + 1)} style={styles.botonCantidad}><Ionicons name="add" size={18} color={colors.black} /></Pressable>
                    </View>
                    <Text style={styles.totalLinea}>{dinero(item.precio * item.cantidad)}</Text>
                    <Pressable accessibilityLabel={`Quitar ${item.nombre}`} disabled={ocupado !== null} onPress={() => void eliminar(item.id_producto)} style={styles.botonEliminar}><Ionicons name="trash-outline" size={20} color={colors.danger} /></Pressable>
                  </View>
                </View>
              </View>
            ))}
            <View style={styles.resumen}>
              <View style={styles.filaResumen}><Text style={styles.textoResumen}>Subtotal</Text><Text style={styles.textoResumen}>{dinero(subtotal)}</Text></View>
              <View style={styles.filaResumen}><Text style={styles.totalLabel}>Total</Text><Text style={styles.total}>{dinero(subtotal)}</Text></View>
              <Text style={styles.nota}>El inventario y el precio se validan nuevamente al confirmar.</Text>
              <PrimaryButton titulo="Continuar al checkout" icono="arrow-forward" deshabilitado={ocupado !== null} onPress={() => router.push("/checkout")} estilo={styles.botonLargo} />
            </View>
          </>
        )}

        <View style={styles.pedidos}>
          <Text style={styles.seccion}>Mis pedidos</Text>
          {pedidos.length === 0 ? <Text style={styles.subtitulo}>Todavía no tienes pedidos.</Text> : pedidos.map((pedido) => (
            <Pressable key={pedido.id_pedido} onPress={() => router.push(`/pedido/${pedido.id_pedido}`)} style={styles.pedido}>
              <View style={{ flex: 1 }}><Text style={styles.nombre}>{pedido.codigo_pedido}</Text><Text style={styles.stock}>{pedido.estado_pedido} · Retiro: {pedido.fecha_retiro}</Text></View>
              <Text style={styles.totalLinea}>{dinero(pedido.total)}</Text><Ionicons name="chevron-forward" size={18} color={colors.gray} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: colors.light },
  contenido: { padding: espaciado.lg, paddingBottom: 36, gap: espaciado.md },
  cabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: espaciado.sm },
  titulo: { fontSize: tipografia.xxl, fontWeight: "800", color: colors.black },
  subtitulo: { color: colors.textoSecundario, fontSize: tipografia.sm, marginTop: 3 },
  actualizar: { width: 42, height: 42, borderRadius: radio.pill, backgroundColor: colors.white, alignItems: "center", justifyContent: "center" },
  carga: { padding: 42 },
  error: { backgroundColor: colors.errorBg, borderColor: colors.errorBorde, borderWidth: 1, borderRadius: radio.sm, padding: espaciado.md },
  errorTexto: { color: colors.errorTexto },
  vacio: { backgroundColor: colors.white, borderRadius: radio.md, padding: espaciado.xl, alignItems: "center", gap: espaciado.md },
  vacioTitulo: { color: colors.black, fontSize: tipografia.lg, fontWeight: "700" },
  botonLargo: { alignSelf: "stretch", marginTop: espaciado.sm },
  producto: { flexDirection: "row", gap: espaciado.md, backgroundColor: colors.white, borderRadius: radio.md, borderWidth: 1, borderColor: colors.bordeClaro, padding: espaciado.md },
  imagen: { width: 82, height: 82, borderRadius: radio.sm, backgroundColor: colors.light },
  imagenVacia: { alignItems: "center", justifyContent: "center" },
  detalle: { flex: 1, gap: 4 },
  nombre: { color: colors.black, fontSize: tipografia.md, fontWeight: "700" },
  precio: { color: colors.textoSecundario, fontSize: tipografia.sm },
  stock: { color: colors.textoSuave, fontSize: tipografia.xs },
  filaProducto: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 5 },
  cantidad: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: colors.borde, borderRadius: radio.sm },
  botonCantidad: { width: 34, height: 34, alignItems: "center", justifyContent: "center" },
  cantidadTexto: { minWidth: 28, textAlign: "center", fontWeight: "700", color: colors.black },
  totalLinea: { color: colors.black, fontWeight: "700" },
  botonEliminar: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  resumen: { backgroundColor: colors.white, borderRadius: radio.md, padding: espaciado.lg, gap: espaciado.md },
  filaResumen: { flexDirection: "row", justifyContent: "space-between" },
  textoResumen: { color: colors.textoSecundario },
  totalLabel: { fontSize: tipografia.lg, color: colors.black, fontWeight: "800" },
  total: { fontSize: tipografia.lg, color: colors.black, fontWeight: "800" },
  nota: { color: colors.textoSuave, fontSize: tipografia.xs },
  pedidos: { marginTop: espaciado.xl, gap: espaciado.sm },
  seccion: { color: colors.black, fontSize: tipografia.lg, fontWeight: "800", marginBottom: espaciado.xs },
  pedido: { flexDirection: "row", alignItems: "center", gap: espaciado.sm, backgroundColor: colors.white, borderRadius: radio.sm, padding: espaciado.md },
});
