import Ionicons from '@expo/vector-icons/Ionicons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { useTheme } from '@/constants/theme';
import { projectColors } from '@/lib/tasks';
import { useTasks } from '@/lib/TaskStore';

// id があれば既存のプロジェクトを編集、なければ新しく作る
export default function ProjectEditScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const theme = useTheme();
  const { projects, tasks, addProject, updateProject, removeProject } = useTasks();
  const project = id ? projects.find((p) => p.id === id) : undefined;
  const [name, setName] = useState(project?.name ?? '');
  const [color, setColor] = useState(project?.color ?? projectColors[projects.length % projectColors.length]);
  const canSave = name.trim().length > 0;

  const save = () => {
    if (!canSave) return;
    if (project) updateProject(project.id, { name: name.trim(), color });
    else addProject(name, color);
    router.back();
  };

  const confirmRemove = () => {
    if (!project) return;
    const count = tasks.filter((t) => t.projectId === project.id).length;
    Alert.alert(
      'プロジェクトを削除',
      count > 0
        ? `「${project.name}」を削除します。中の${count}件のタスクは消えずに「プロジェクトなし」になります。`
        : `「${project.name}」を削除します。`,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: '削除',
          style: 'destructive',
          onPress: () => {
            removeProject(project.id);
            router.back();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={{ backgroundColor: theme.background }}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <Stack.Screen options={{ title: project ? 'プロジェクトの編集' : '新しいプロジェクト' }} />

      <TextInput
        value={name}
        onChangeText={setName}
        onSubmitEditing={save}
        placeholder="プロジェクト名（例：仕事、家のこと）"
        placeholderTextColor={theme.subText}
        autoFocus={!project}
        returnKeyType="done"
        style={[styles.nameInput, { color: theme.text, backgroundColor: theme.surface, borderColor: theme.border }]}
      />

      <View style={styles.section}>
        <Text style={[styles.label, { color: theme.subText }]}>色</Text>
        <View style={styles.colors}>
          {projectColors.map((c) => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              accessibilityLabel={`色 ${c}`}
              style={[styles.colorButton, { backgroundColor: c, borderColor: c === color ? theme.text : 'transparent' }]}
            >
              {c === color && <Ionicons name="checkmark" size={20} color="#FFFFFF" />}
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable
        onPress={save}
        disabled={!canSave}
        style={[styles.button, { backgroundColor: theme.primary, opacity: canSave ? 1 : 0.4 }]}
      >
        <Text style={[styles.buttonText, { color: theme.onPrimary }]}>{project ? '保存' : '作成'}</Text>
      </Pressable>

      {project && (
        <Pressable onPress={confirmRemove} style={styles.removeButton} hitSlop={8}>
          <Text style={[styles.removeText, { color: theme.danger }]}>このプロジェクトを削除</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 20,
  },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    padding: 16,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    marginLeft: 4,
  },
  colors: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  removeButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  removeText: {
    fontSize: 15,
  },
});
