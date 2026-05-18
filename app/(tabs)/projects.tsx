import { StyleSheet, FlatList, View, Text, TouchableOpacity } from 'react-native';
import { useDispatch } from '../../context/DispatchContext';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Folder, Users } from 'lucide-react-native';

interface ProjectSpace {
  id: string;
  title: string;
  agent_count: number;
  last_active: number;
}

export default function ProjectsScreen() {
  const { status, sendMessage, subscribe } = useDispatch();
  const [projects, setProjects] = useState<ProjectSpace[]>([]);

  useEffect(() => {
    if (status === 'connected') {
      sendMessage('list_projects');
      const unsubscribe = subscribe('projects_list', (payload: ProjectSpace[]) => {
        setProjects(payload);
      });
      return unsubscribe;
    } else {
      // Mock data for preview when disconnected
      setProjects([
        {
          id: 'proj_auth',
          title: 'Auth Refactor',
          agent_count: 3,
          last_active: Date.now() - 1000 * 60 * 30,
        },
        {
          id: 'proj_marketing',
          title: 'Launch Campaign',
          agent_count: 2,
          last_active: Date.now() - 1000 * 60 * 60 * 2,
        }
      ]);
    }
  }, [status, sendMessage, subscribe]);

  const renderProject = ({ item }: { item: ProjectSpace }) => {
    return (
      <TouchableOpacity 
        style={styles.card}
        onPress={() => router.push(`/chat/${item.id}?name=${encodeURIComponent(item.title)}`)}
      >
        <View style={styles.iconBox}>
          <Folder size={24} color="#3c6663" />
        </View>
        <View style={styles.info}>
          <Text style={styles.titleText}>{item.title}</Text>
          <View style={styles.metaRow}>
            <Users size={12} color="#718096" />
            <Text style={styles.metaText}>{item.agent_count} agents</Text>
            <Text style={styles.metaDot}>•</Text>
            <Text style={styles.metaText}>Active {new Date(item.last_active).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Text style={styles.pageTitle}>Project Spaces</Text>
      <View style={styles.separator} />
      
      <FlatList
        data={projects}
        keyExtractor={p => p.id}
        renderItem={renderProject}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingTop: 60,
    backgroundColor: '#faf9f6',
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#2D3748',
    paddingHorizontal: 20,
  },
  separator: {
    marginVertical: 16,
    height: 1,
    width: '100%',
    backgroundColor: '#E2E8F0',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
    elevation: 1,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#F0F4F8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  info: {
    flex: 1,
  },
  titleText: {
    fontSize: 17,
    fontWeight: '600',
    color: '#2D3748',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: '#718096',
  },
  metaDot: {
    fontSize: 12,
    color: '#CBD5E0',
    marginHorizontal: 2,
  }
});
