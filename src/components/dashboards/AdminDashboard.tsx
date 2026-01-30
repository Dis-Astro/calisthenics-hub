import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { 
  SidebarProvider, 
  Sidebar, 
  SidebarContent, 
  SidebarGroup, 
  SidebarGroupLabel, 
  SidebarGroupContent, 
  SidebarMenu, 
  SidebarMenuItem, 
  SidebarMenuButton,
  SidebarTrigger
} from '@/components/ui/sidebar';
import { 
  Users, 
  CreditCard, 
  Calendar, 
  ClipboardList, 
  Video, 
  FileText, 
  BarChart3, 
  Bell, 
  Settings,
  LogOut,
  Home,
  Dumbbell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

type AdminView = 
  | 'overview' 
  | 'users' 
  | 'subscriptions' 
  | 'calendar' 
  | 'courses' 
  | 'exercises' 
  | 'workout-plans' 
  | 'documents' 
  | 'stats' 
  | 'notifications' 
  | 'settings';

const AdminDashboard = () => {
  const { signOut, profile } = useAuth();
  const [currentView, setCurrentView] = useState<AdminView>('overview');

  const menuItems = [
    { id: 'overview' as AdminView, label: 'Dashboard', icon: Home },
    { id: 'users' as AdminView, label: 'Gestione Utenti', icon: Users },
    { id: 'subscriptions' as AdminView, label: 'Abbonamenti', icon: CreditCard },
    { id: 'calendar' as AdminView, label: 'Appuntamenti', icon: Calendar },
    { id: 'courses' as AdminView, label: 'Corsi', icon: Dumbbell },
    { id: 'exercises' as AdminView, label: 'Libreria Esercizi', icon: Video },
    { id: 'workout-plans' as AdminView, label: 'Schede', icon: ClipboardList },
    { id: 'documents' as AdminView, label: 'Documenti', icon: FileText },
    { id: 'stats' as AdminView, label: 'Statistiche', icon: BarChart3 },
    { id: 'notifications' as AdminView, label: 'Notifiche', icon: Bell },
    { id: 'settings' as AdminView, label: 'Impostazioni', icon: Settings },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'overview':
        return <OverviewContent />;
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">Sezione "{menuItems.find(m => m.id === currentView)?.label}" in arrivo...</p>
          </div>
        );
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <Sidebar className="border-r border-border">
          <div className="p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-amber-400 to-amber-600 rounded-full flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-background" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Power Gym</h2>
                <p className="text-xs text-muted-foreground">Admin Panel</p>
              </div>
            </div>
          </div>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton 
                        onClick={() => setCurrentView(item.id)}
                        className={currentView === item.id ? 'bg-accent text-accent-foreground' : ''}
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          <div className="mt-auto p-4 border-t border-border">
            <Button 
              variant="ghost" 
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Esci
            </Button>
          </div>
        </Sidebar>

        <main className="flex-1 overflow-auto">
          <header className="h-14 border-b border-border flex items-center px-6 bg-card">
            <SidebarTrigger className="mr-4" />
            <h1 className="text-lg font-semibold">
              {menuItems.find(m => m.id === currentView)?.label || 'Dashboard'}
            </h1>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Ciao, {profile?.full_name || 'Admin'}
              </span>
            </div>
          </header>
          
          <div className="p-6">
            {renderContent()}
          </div>
        </main>
      </div>
    </SidebarProvider>
  );
};

const OverviewContent = () => {
  const stats = [
    { label: 'Clienti Attivi', value: '0', icon: Users, color: 'text-blue-500' },
    { label: 'Abbonamenti Attivi', value: '0', icon: CreditCard, color: 'text-green-500' },
    { label: 'Appuntamenti Oggi', value: '0', icon: Calendar, color: 'text-amber-500' },
    { label: 'In Scadenza (7gg)', value: '0', icon: Bell, color: 'text-red-500' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {stat.label}
              </CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Appuntamenti di Oggi</CardTitle>
            <CardDescription>Nessun appuntamento programmato</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Gli appuntamenti appariranno qui quando verranno creati.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Abbonamenti in Scadenza</CardTitle>
            <CardDescription>Prossimi 7 giorni</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nessun abbonamento in scadenza nei prossimi 7 giorni.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminDashboard;
