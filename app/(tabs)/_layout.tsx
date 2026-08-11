import React from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs } from 'expo-router';
import { Pressable } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';
import { useDispatch } from '../../context/DispatchContext';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { assignment } = useDispatch();
  const isFocusedCompanion = assignment?.experience === 'focused' || assignment?.experience === 'learning';

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#3c6663',
        tabBarInactiveTintColor: '#A0AEC0',
        tabBarStyle: {
          backgroundColor: '#faf9f6',
          borderTopColor: '#E2E8F0',
          elevation: 0,
          shadowOpacity: 0,
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      {/* QR pairing lives at /pair (a full-screen modal reached from Home's
          connect/reconnect buttons) instead of a permanent bottom tab — it's
          a one-time setup action, not a surface people revisit. This entry
          stays registered with href: null purely so the leftover
          app/(tabs)/two.tsx redirect stub doesn't get an auto-generated tab. */}
      <Tabs.Screen
        name="two"
        options={{ href: null }}
      />
      <Tabs.Screen
        name="forums"
        options={{
          title: 'Forums',
          href: isFocusedCompanion ? null : undefined,
          tabBarIcon: ({ color }) => <TabBarIcon name="group" color={color} />,
        }}
      />
      <Tabs.Screen
        name="inbox"
        options={{
          title: 'Inbox',
          href: isFocusedCompanion ? null : undefined,
          tabBarIcon: ({ color }) => <TabBarIcon name="inbox" color={color} />,
        }}
      />
      <Tabs.Screen
        name="sensors"
        options={{
          title: 'Sensors',
          href: isFocusedCompanion ? null : undefined,
          tabBarIcon: ({ color }) => <TabBarIcon name="feed" color={color} />,
        }}
      />
    </Tabs>
  );
}
