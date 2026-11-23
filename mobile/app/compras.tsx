import { useCallback, useRef, useState } from "react";
import { ScrollView, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { randomUUID } from "expo-crypto";
import AppHeader from "../src/components/AppHeader";
import PrimaryButton from "../src/components/PrimaryButton";
import {
  cargarCompras,
  confirmarRetiro,
  quitarProducto,
} from "../src/services/operaciones";

export default function Compras() {
  const [datos, setDatos] = useState<Awaited<
    ReturnType<typeof cargarCompras>
  > | null>(null);
  const [pagoTarjeta, setPagoTarjeta] = useState(false);
  const [tarjeta, setTarjeta] = useState({
    numero: "",
    vencimiento: "",
    cvv: "",
  });
  const [fecha, setFecha] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const bloqueo = useRef(false);
  const clave = useRef("");
  const cargar = useCallback(async () => {
    const resultado = await cargarCompras();
    setDatos(resultado);
    setFecha((actual) =>
      resultado.fechas.includes(actual) ? actual : (resultado.fechas[0] ?? ""),
    );
  }, []);
  useFocusEffect(
    useCallback(() => {
      cargar().catch((e) => setMensaje(e.message));
    }, [cargar]),
  );
  async function operar(accion: () => Promise<void>) {
    if (bloqueo.current) return;
    bloqueo.current = true;
    setOcupado(true);
    setMensaje("");
    try {
      await accion();
      await cargar();
    } catch (e) {
      setMensaje(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      );
    } finally {
      bloqueo.current = false;
      setOcupado(false);
    }
  }
  return (
    <View style={{ flex: 1 }}>
      <AppHeader onVolver={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}>
        <Text style={{ fontSize: 24, fontWeight: "bold" }}>Mis compras</Text>
        {!!mensaje && <Text accessibilityLiveRegion="polite">{mensaje}</Text>}
        <PrimaryButton
          titulo="Actualizar"
          variante="contorno"
          deshabilitado={ocupado}
          onPress={() => void operar(async () => {})}
        />
        {datos && (
          <>
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>Carrito</Text>
            {!datos.items.length && <Text>Tu carrito está vacío.</Text>}
            {datos.items.map((i) => (
              <View key={i.id_producto}>
                <Text>
                  {i.nombre} · {i.cantidad} × ${i.precio.toFixed(2)}
                </Text>
                <PrimaryButton
                  titulo="Quitar"
                  variante="contorno"
                  deshabilitado={ocupado}
                  onPress={() =>
                    void operar(async () => {
                      await quitarProducto(i.id_producto);
                      clave.current = "";
                    })
                  }
                />
              </View>
            ))}
            {datos.items.length > 0 && (
              <>
                <Text>
                  Total: $
                  {datos.items
                    .reduce((s, i) => s + i.cantidad * i.precio, 0)
                    .toFixed(2)}
                </Text>
                <Text>Fecha de retiro</Text>
                {datos.fechas.map((f) => (
                  <PrimaryButton
                    key={f}
                    titulo={f}
                    variante={f === fecha ? "primario" : "contorno"}
                    deshabilitado={ocupado}
                    onPress={() => {
                      if (f !== fecha) clave.current = "";
                      setFecha(f);
                    }}
                  />
                ))}
                <PrimaryButton
                  titulo={
                    pagoTarjeta
                      ? "Pagar en efectivo"
                      : "Usar tarjeta de demostración"
                  }
                  variante="contorno"
                  deshabilitado={ocupado}
                  onPress={() => {
                    setPagoTarjeta(!pagoTarjeta);
                    clave.current = "";
                  }}
                />
                {pagoTarjeta && (
                  <View>
                    <Text>Tarjeta de demostración</Text>
                    {(["numero", "vencimiento", "cvv"] as const).map((c) => (
                      <TextInput
                        key={c}
                        value={tarjeta[c]}
                        accessibilityLabel={c}
                        placeholder={
                          c === "vencimiento"
                            ? "MM/AA"
                            : c === "numero"
                              ? "Número de prueba"
                              : "CVV de prueba"
                        }
                        secureTextEntry={c === "cvv"}
                        editable={!ocupado}
                        onChangeText={(v) => {
                          setTarjeta((t) => ({ ...t, [c]: v }));
                          clave.current = "";
                        }}
                      />
                    ))}
                  </View>
                )}
                <PrimaryButton
                  titulo="Confirmar pedido"
                  deshabilitado={ocupado || !fecha}
                  onPress={() =>
                    void operar(async () => {
                      if (!clave.current) clave.current = randomUUID();
                      const pedido = await confirmarRetiro(
                        fecha,
                        clave.current,
                        pagoTarjeta ? tarjeta : undefined,
                      );
                      clave.current = "";
                      setTarjeta({ numero: "", vencimiento: "", cvv: "" });
                      setMensaje(
                        pedido.mensaje ||
                          "Pedido " + pedido.codigo_pedido + " registrado.",
                      );
                    })
                  }
                />
              </>
            )}
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>Pedidos</Text>
            {!datos.pedidos.length && <Text>Todavía no hay pedidos.</Text>}
            {datos.pedidos.map((p) => (
              <Text key={p.id_pedido}>
                {p.codigo_pedido} · {p.estado_pedido} · ${p.total.toFixed(2)}
              </Text>
            ))}
            <Text style={{ fontSize: 18, fontWeight: "bold" }}>
              Notificaciones
            </Text>
            {!datos.avisos.length && <Text>Sin notificaciones.</Text>}
            {datos.avisos.map((a) => (
              <Text key={a.id_notificacion}>
                {a.titulo} · {a.descripcion}
              </Text>
            ))}
          </>
        )}
      </ScrollView>
    </View>
  );
}
