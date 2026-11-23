import { useCallback, useState } from "react";
import { Alert, ScrollView, Text, TextInput, View } from "react-native";
import { router, useFocusEffect } from "expo-router";
import AppHeader from "../../src/components/AppHeader";
import PrimaryButton from "../../src/components/PrimaryButton";
import { administrarCatalogo } from "../../src/services/operaciones";

interface Cuenta {
  id_usuario: number;
  nombre: string;
  email: string;
  id_rol: number;
  estado: boolean;
}
const inicial = {
  nombre: "",
  email: "",
  password: "",
  id_rol: 2,
  estado: true,
};
export default function Cuentas() {
  const [cuentas, setCuentas] = useState<Cuenta[]>([]);
  const [id, setId] = useState<number | null>(null);
  const [form, setForm] = useState(inicial);
  const [mensaje, setMensaje] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const cargar = useCallback(async () => {
    const data = (await administrarCatalogo("/usuarios", "GET")) as {
      usuarios: Cuenta[];
    };
    setCuentas(data.usuarios);
  }, []);
  useFocusEffect(
    useCallback(() => {
      cargar().catch((e) => setMensaje(e.message));
    }, [cargar]),
  );
  async function guardar() {
    if (ocupado) return;
    setOcupado(true);
    try {
      await administrarCatalogo(
        id ? "/usuarios/" + id : "/usuarios",
        id ? "PUT" : "POST",
        form,
      );
      setForm(inicial);
      setId(null);
      await cargar();
      setMensaje("Cuenta guardada.");
    } catch (e) {
      setMensaje(e instanceof Error ? e.message : "No se pudo guardar.");
    } finally {
      setOcupado(false);
    }
  }
  return (
    <View style={{ flex: 1 }}>
      <AppHeader onVolver={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: 18, gap: 12 }}>
        <Text style={{ fontSize: 22, fontWeight: "bold" }}>
          Cuentas de usuario
        </Text>
        {cuentas.map((u) => (
          <PrimaryButton
            key={u.id_usuario}
            variante="contorno"
            titulo={u.nombre + " · " + u.email}
            onPress={() => {
              setId(u.id_usuario);
              setForm({
                nombre: u.nombre,
                email: u.email,
                password: "",
                id_rol: u.id_rol,
                estado: u.estado,
              });
            }}
          />
        ))}
        <PrimaryButton
          titulo="Nueva cuenta"
          variante="contorno"
          onPress={() => {
            setId(null);
            setForm(inicial);
          }}
        />
        <Text>{id ? "Editar cuenta" : "Crear cuenta"}</Text>
        {(["nombre", "email", "password"] as const).map((k) => (
          <TextInput
            key={k}
            value={form[k]}
            secureTextEntry={k === "password"}
            accessibilityLabel={k}
            placeholder={
              k === "password" && id ? "Contraseña nueva (opcional)" : k
            }
            autoCapitalize="none"
            onChangeText={(v) => setForm((f) => ({ ...f, [k]: v }))}
          />
        ))}
        <PrimaryButton
          variante="contorno"
          titulo={form.id_rol === 1 ? "Rol: administrador" : "Rol: cliente"}
          onPress={() =>
            setForm((f) => ({ ...f, id_rol: f.id_rol === 1 ? 2 : 1 }))
          }
        />
        <PrimaryButton
          variante="contorno"
          titulo={form.estado ? "Cuenta activa" : "Cuenta inactiva"}
          onPress={() => setForm((f) => ({ ...f, estado: !f.estado }))}
        />
        <PrimaryButton
          titulo="Guardar"
          cargando={ocupado}
          onPress={() =>
            Alert.alert("Guardar cuenta", form.email, [
              { text: "Volver", style: "cancel" },
              { text: "Guardar", onPress: () => void guardar() },
            ])
          }
        />
        <Text accessibilityLiveRegion="polite">{mensaje}</Text>
      </ScrollView>
    </View>
  );
}
