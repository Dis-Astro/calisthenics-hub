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
  Clock, 
  Calendar, 
  FileText, 
  CreditCard, 
  User,
  LogOut,
  Home,
  Dumbbell
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useState } from 'react';

interface GymClientDashboardProps {
  profile: any;
}

type ClientView = 'overview' | 'schedule' | 'courses' | 'documents' | 'payments' | 'profile';

const GymClientDashboard = ({ profile }: GymClientDashboardProps) => {
  const { signOut } = useAuth();
  const [currentView, setCurrentView] = useState<ClientView>('overview');

  const menuItems = [
    { id: 'overview' as ClientView, label: 'Home', icon: Home },
    { id: 'schedule' as ClientView, label: 'Orari Palestra', icon: Clock },
    { id: 'courses' as ClientView, label: 'Corsi', icon: Calendar },
    { id: 'documents' as ClientView, label: 'I Miei Documenti', icon: FileText },
    { id: 'payments' as ClientView, label: 'Storico Pagamenti', icon: CreditCard },
    { id: 'profile' as ClientView, label: 'Dati Anagrafici', icon: User },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'overview':
        return <OverviewContent profile={profile} />;
      case 'profile':
        return <ProfileContent profile={profile} />;
      default:
        return (
          <div className="flex items-center justify-center h-64">
            <p className="text-muted-foreground">
              Sezione "{menuItems.find(m => m.id === currentView)?.label}" in arrivo...
            </p>
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
                <p className="text-xs text-muted-foreground">Area Cliente</p>
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
              {menuItems.find(m => m.id === currentView)?.label || 'Home'}
            </h1>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Ciao, {profile?.full_name || 'Cliente'}
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

const OverviewContent = ({ profile }: { profile: any }) => {
  return (
    <div className="space-y-6">
      <Card className="bg-gradient-to-r from-amber-500/10 to-amber-600/10 border-amber-500/20">
        <CardHeader>
          <CardTitle>Benvenuto, {profile?.full_name || 'Cliente'}! 🎉</CardTitle>
          <CardDescription>
            Accedi alla tua area personale per consultare orari, corsi e documenti.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-500" />
              Orari Palestra
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Lunedì - Venerdì</span>
                <span className="font-medium">6:00 - 22:00</span>
              </div>
              <div className="flex justify-between">
                <span>Sabato</span>
                <span className="font-medium">8:00 - 20:00</span>
              </div>
              <div className="flex justify-between">
                <span>Domenica</span>
                <span className="font-medium">9:00 - 14:00</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-green-500" />
              Il Tuo Abbonamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nessun abbonamento attivo. Contatta la reception per attivarne uno.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ProfileContent = ({ profile }: { profile: any }) => {
  if (!profile) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-muted-foreground">Profilo non trovato.</p>
        </CardContent>
      </Card>
    );
  }

  const fields = [
    { label: 'Nome Completo', value: profile.full_name },
    { label: 'Email', value: profile.email },
    { label: 'Telefono', value: profile.phone },
    { label: 'Data di Nascita', value: profile.birth_date },
    { label: 'Codice Fiscale', value: profile.fiscal_code },
    { label: 'Indirizzo', value: profile.address },
    { label: 'Contatto Emergenza', value: profile.emergency_contact },
    { label: 'Tel. Emergenza', value: profile.emergency_phone },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>I Tuoi Dati</CardTitle>
        <CardDescription>
          Per modificare i tuoi dati, contatta l'amministrazione.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          {fields.map((field) => (
            <div key={field.label} className="space-y-1">
              <p className="text-sm text-muted-foreground">{field.label}</p>
              <p className="font-medium">{field.value || '-'}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default GymClientDashboard;
