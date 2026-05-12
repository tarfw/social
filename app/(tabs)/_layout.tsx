import { Tabs } from 'expo-router';
import { Home, Search, Bell, User, MessageSquare } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { THEME } from '../../constants/theme';

// Map route name → icon component
const TAB_ICONS: Record<string, (props: { color: string; size: number }) => JSX.Element> = {
  index:         ({ color, size }) => <Home          size={size} color={color} strokeWidth={2} />,
  search:        ({ color, size }) => <Search        size={size} color={color} strokeWidth={2} />,
  notifications: ({ color, size }) => <Bell          size={size} color={color} strokeWidth={2} />,
  chat:          ({ color, size }) => <MessageSquare  size={size} color={color} strokeWidth={2} />,
  profile:       ({ color, size }) => <User          size={size} color={color} strokeWidth={2} />,
};

const TAB_TITLES: Record<string, string> = {
  index:          'Home',
  search:        'Search',
  notifications: 'Alerts',
  chat:          'Chat',
  profile:       'Profile',
};

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: THEME.primary,
        tabBarInactiveTintColor: '#8E8E93',
        tabBarStyle: {
          borderTopWidth: 0.5,
          borderTopColor: '#C6C6C8',
          backgroundColor: '#FFFFFF',
          height: 56 + insets.bottom,
          paddingBottom: insets.bottom,
          paddingTop: 6,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginTop: 0,
        },
        // Drive icon + title purely from the route name — no <Tabs.Screen> children needed
        title: TAB_TITLES[route.name] ?? route.name,
        tabBarIcon: TAB_ICONS[route.name] ?? (() => null),
      })}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="notifications" />
      <Tabs.Screen name="profile" />
      <Tabs.Screen name="chat" />
    </Tabs>
  );
}
