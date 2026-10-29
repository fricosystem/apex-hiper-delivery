import { savedAddressInputSchema, type LatLng } from '@hiper/shared';
import * as Location from 'expo-location';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { PinPicker } from '@/components/map/delivery-map';
import { Button, Chip, Input, Loading, Screen, SectionTitle, Text } from '@/components/ui';
import { data } from '@/data';
import { geocodeAddress } from '@/services/geocode';
import { formatCep, lookupCep } from '@/services/viacep';
import { useAuth } from '@/state/auth';
import { Spacing } from '@/theme/tokens';

const LABELS = ['Casa', 'Trabalho', 'Outro'];

/**
 * Endereço pelo CEP (ViaCEP), ponto no mapa pelo Nominatim e ajuste do pino
 * pelo cliente, porque a geocodificação gratuita às vezes erra o número.
 */
export default function AddressFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string; back?: string }>();
  const { user } = useAuth();
  const [loading, setLoading] = useState(!!id);
  const [label, setLabel] = useState('Casa');
  const [cep, setCep] = useState('');
  const [street, setStreet] = useState('');
  const [number, setNumber] = useState('');
  const [complement, setComplement] = useState('');
  const [district, setDistrict] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [reference, setReference] = useState('');
  const [location, setLocation] = useState<LatLng | null>(null);
  const [cepStatus, setCepStatus] = useState<'idle' | 'loading' | 'notfound'>('idle');
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!id || !user) return;
    void data()
      .listAddresses(user.uid)
      .then((list) => {
        const a = list.find((x) => x.id === id);
        if (a) {
          setLabel(a.label);
          setCep(a.cep);
          setStreet(a.street);
          setNumber(a.number);
          setComplement(a.complement ?? '');
          setDistrict(a.district);
          setCity(a.city);
          setState(a.state);
          setReference(a.reference ?? '');
          setLocation(a.location);
        }
        setLoading(false);
      });
  }, [id, user]);

  const onCep = async (value: string) => {
    setCep(value.replace(/\D/g, '').slice(0, 8));
    const digits = value.replace(/\D/g, '');
    if (digits.length !== 8) return;
    setCepStatus('loading');
    try {
      const found = await lookupCep(digits);
      if (!found) return setCepStatus('notfound');
      setStreet(found.street);
      setDistrict(found.district);
      setCity(found.city);
      setState(found.state);
      setCepStatus('idle');
    } catch {
      setCepStatus('notfound');
    }
  };

  const locate = async () => {
    setLocating(true);
    setError(null);
    const point = await geocodeAddress({ street, number, city, state, cep });
    if (point) setLocation(point);
    else setError('Não achamos o ponto no mapa. Use sua localização ou toque no mapa.');
    setLocating(false);
  };

  const useMyLocation = async () => {
    try {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (!perm.granted) return setError('Sem permissão de localização.');
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
    } catch {
      setError('Não foi possível pegar sua localização.');
    }
  };

  // Ao completar o número, procura o ponto sozinho uma vez.
  useEffect(() => {
    if (!location && street && number && city && !id) {
      const t = setTimeout(() => void locate(), 700);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [street, number, city]);

  const save = async () => {
    if (!user) return;
    const parsed = savedAddressInputSchema.safeParse({
      label,
      cep,
      street,
      number,
      complement: complement.trim() || null,
      district,
      city,
      state,
      location,
      reference: reference.trim() || null,
    });
    if (!parsed.success) {
      return setError(
        location ? 'Confira os campos do endereço.' : 'Marque o ponto de entrega no mapa.',
      );
    }
    setBusy(true);
    try {
      await data().saveAddress(user.uid, parsed.data, id);
      router.back();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading />;

  return (
    <Screen footer={<Button size="lg" title="Salvar endereço" loading={busy} onPress={save} />}>
      <Stack.Screen options={{ title: id ? 'Editar endereço' : 'Novo endereço' }} />
      <View style={styles.form}>
        <View style={styles.row}>
          <Input
            label="CEP"
            value={formatCep(cep)}
            onChangeText={onCep}
            keyboardType="number-pad"
            placeholder="00000-000"
            hint={cepStatus === 'loading' ? 'Buscando…' : undefined}
            error={cepStatus === 'notfound' ? 'CEP não encontrado. Preencha à mão.' : null}
          />
        </View>
        <View style={styles.row}>
          <Input label="Rua" value={street} onChangeText={setStreet} />
        </View>
        <View style={styles.row}>
          <Input label="Número" value={number} onChangeText={setNumber} keyboardType="default" />
          <Input
            label="Complemento"
            value={complement}
            onChangeText={setComplement}
            placeholder="Apto, bloco"
          />
        </View>
        <View style={styles.row}>
          <Input label="Bairro" value={district} onChangeText={setDistrict} />
        </View>
        <View style={styles.row}>
          <Input label="Cidade" value={city} onChangeText={setCity} />
          <View style={{ width: 90 }}>
            <Input
              label="UF"
              value={state}
              onChangeText={(t) => setState(t.toUpperCase().slice(0, 2))}
              autoCapitalize="characters"
            />
          </View>
        </View>
        <View style={styles.row}>
          <Input
            label="Ponto de referência"
            value={reference}
            onChangeText={setReference}
            placeholder="Ex.: portão azul"
          />
        </View>
      </View>

      <SectionTitle>Ponto de entrega</SectionTitle>
      {location ? (
        <>
          <PinPicker value={location} onChange={setLocation} />
          <Text variant="caption" color="textSecondary" style={{ marginTop: Spacing.sm }}>
            Toque no mapa ou arraste o pino até a sua porta. É por aqui que o entregador chega.
          </Text>
        </>
      ) : locating ? (
        <Loading label="Procurando no mapa" />
      ) : (
        <Text variant="caption" color="textSecondary">
          Preencha o endereço para ver o mapa.
        </Text>
      )}
      <View style={[styles.row, { marginTop: Spacing.md }]}>
        <Button
          variant="secondary"
          title="Achar pelo endereço"
          onPress={locate}
          disabled={!street || !city}
          style={{ flex: 1 }}
        />
        <Button
          variant="secondary"
          title="Usar minha localização"
          onPress={useMyLocation}
          style={{ flex: 1 }}
        />
      </View>

      <SectionTitle>Salvar como</SectionTitle>
      <View style={styles.chips}>
        {LABELS.map((l) => (
          <Chip key={l} label={l} selected={label === l} onPress={() => setLabel(l)} />
        ))}
      </View>
      {error ? (
        <Text color="danger" style={{ marginTop: Spacing.md }}>
          {error}
        </Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  form: { gap: Spacing.md },
  row: { flexDirection: 'row', gap: Spacing.md },
  chips: { flexDirection: 'row', gap: Spacing.sm },
});
