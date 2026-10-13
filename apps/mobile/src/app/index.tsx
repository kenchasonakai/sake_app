import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ActivityIndicator, FlatList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';

const sakesKey = ['sakes'] as const;

async function fetchSakes() {
  const res = await api.sakes.$get();
  if (!res.ok) throw new Error(`GET /sakes failed: ${res.status}`);
  return res.json();
}

export default function HomeScreen() {
  const queryClient = useQueryClient();
  const sakes = useQuery({ queryKey: sakesKey, queryFn: fetchSakes });

  // 動作確認用。フォームができたら差し替える。
  const addSample = useMutation({
    mutationFn: async () => {
      const res = await api.sakes.$post({
        json: { name: `サンプル ${new Date().toLocaleTimeString()}`, type: 'junmai', rating: 4 },
      });
      if (!res.ok) throw new Error(`POST /sakes failed: ${res.status}`);
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sakesKey }),
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Sake</ThemedText>

        <Pressable onPress={() => addSample.mutate()} disabled={addSample.isPending}>
          <ThemedView type="backgroundElement" style={styles.button}>
            <ThemedText>{addSample.isPending ? '追加中…' : 'サンプルを追加'}</ThemedText>
          </ThemedView>
        </Pressable>

        {sakes.isPending && <ActivityIndicator />}
        {sakes.isError && (
          <ThemedText type="small">
            API に接続できません: {sakes.error.message}
            {'\n'}EXPO_PUBLIC_API_URL={process.env.EXPO_PUBLIC_API_URL ?? '(未設定)'}
          </ThemedText>
        )}

        <FlatList
          style={styles.list}
          data={sakes.data ?? []}
          keyExtractor={(item) => item.id}
          ItemSeparatorComponent={() => <ThemedView style={styles.separator} />}
          ListEmptyComponent={
            sakes.isSuccess ? <ThemedText type="small">まだ記録がありません</ThemedText> : null
          }
          renderItem={({ item }) => (
            <ThemedView type="backgroundElement" style={styles.row}>
              <ThemedText type="subtitle">{item.name}</ThemedText>
              <ThemedText type="small">
                {item.type}
                {item.rating != null ? ` · ★${item.rating}` : ''}
              </ThemedText>
            </ThemedView>
          )}
        />
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    flexDirection: 'row',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.three,
    maxWidth: MaxContentWidth,
  },
  button: {
    alignSelf: 'flex-start',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.four,
  },
  list: {
    alignSelf: 'stretch',
  },
  row: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  separator: {
    height: Spacing.two,
  },
});
