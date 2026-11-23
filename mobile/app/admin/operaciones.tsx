import { useCallback, useRef, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import AppHeader from "../../src/components/AppHeader";
import PrimaryButton from "../../src/components/PrimaryButton";
import {
  cargarOperacionAdmin,
  cambiarPedido,
  registrarMovimiento,
} from "../../src/services/operaciones";

export default function Operaciones() {
  const [datos, setDatos] = useState<Awaited<
    ReturnType<typeof cargarOperacionAdmin>
  > | null>(null);
  const [mensaje, setMensaje] = useState("");
  const [cantidad, setCantidad] = useState("1");
  const [motivo, setMotivo] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const cargar = useCallback(async () => {
    setDatos(await cargarOperacionAdmin());
  }, []);
  useFocusEffect(
    useCallback(() => {
      cargar().catch((e) => setMensaje(e.message));
    }, [cargar]),
  );
  async function guardar(accion: () => Promise<void>) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setMensaje("");
    try {
      await accion();
      await cargar();
      setMensaje("Cambios guardados.");
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "Error al guardar.");
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  const confirmar = (titulo: string, accion: () => Promise<void>) =>
    Alert.alert(titulo, "Confirma la operación.", [
      { text: "Volver", style: "cancel" },
      { text: "Confirmar", onPress: () => void guardar(accion) },
    ]);
  return (
    <View style={{ flex: 1 }}>
      <AppHeader onVolver={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold" }}>
          Inventario y pedidos
        </Text>
        <Text accessibilityLiveRegion="polite">{mensaje}</Text>
        <PrimaryButton
          titulo="Actualizar"
          variante="contorno"
          deshabilitado={ocupado}
          onPress={() => void guardar(async () => {})}
        />
        <TextInput
          placeholder="Motivo de ajuste o cancelación"
          accessibilityLabel="Motivo"
          value={motivo}
          onChangeText={setMotivo}
        />
        <TextInput
          placeholder="Unidades"
          accessibilityLabel="Cantidad"
          keyboardType="number-pad"
          value={cantidad}
          onChangeText={setCantidad}
        />
        {datos?.articulos.map((p) => (
          <View key={p.id_producto}>
            <Text>
              {p.nombre} · {p.stock_actual} físicas · {p.stock_disponible}{" "}
              disponibles
            </Text>
            {(["entrada", "salida"] as const).map((tipo) => (
              <PrimaryButton
                key={tipo}
                titulo={"Registrar " + tipo}
                variante="contorno"
                deshabilitado={
                  ocupado || !motivo.trim() || !/^[1-9]\d*$/.test(cantidad)
                }
                onPress={() =>
                  confirmar(tipo + " de " + cantidad + " · " + p.nombre, () =>
                    registrarMovimiento(
                      p.id_producto,
                      tipo,
                      Number(cantidad),
                      motivo.trim(),
                    ),
                  )
                }
              />
            ))}
          </View>
        ))}
        <Text style={{ fontSize: 18, fontWeight: "bold" }}>Pedidos</Text>
        {datos?.pedidos.map((p) => (
          <View key={p.id_pedido}>
            <Text>
              {p.codigo_pedido} · {p.estado_pedido}
            </Text>
            {[
              ["confirmar_pago", "Confirmar pago"],
              ["marcar_pendiente", "Marcar pendiente"],
              ["entregar", "Entregar"],
              ["cancelar", "Cancelar"],
            ].map(([accion, titulo]) => (
              <PrimaryButton
                key={accion}
                titulo={titulo}
                variante="contorno"
                deshabilitado={
                  ocupado || (accion === "cancelar" && !motivo.trim())
                }
                onPress={() =>
                  confirmar(titulo + " · " + p.codigo_pedido, () =>
                    cambiarPedido(p.id_pedido, accion, motivo.trim()),
                  )
                }
              />
            ))}
          </View>
        ))}
        <Text style={{ fontSize: 18, fontWeight: "bold" }}>Movimientos</Text>
        {datos?.movimientos.map((m) => (
          <Text key={m.id_movimiento}>
            {m.producto} · {m.tipo_movimiento} · {m.cantidad}
          </Text>
        ))}
        <Text style={{ fontSize: 18, fontWeight: "bold" }}>Notificaciones</Text>
        {datos?.avisos.map((a) => (
          <Text key={a.id_notificacion}>
            {a.titulo} · {a.descripcion}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}
