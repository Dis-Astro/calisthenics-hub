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
  Clock, 
  Calendar, 
  FileText, 
  CreditCard, 
  User,
  LogOut,
  Home,
  Dumbbell,
  ClipboardList,
  History,
  StickyNote,
  TrendingUp,
  Video,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface CoachingClientDashboardProps {
  profile: any;
}

type CoachingView = 
  | 'overview' 
  | 'workout-plan' 
  | 'calendar' 
  | 'history' 
  | 'notes' 
  | 'progress'
  | 'schedule' 
  | 'courses' 
  | 'documents' 
  | 'payments' 
  | 'profile';

const CoachingClientDashboard = ({ profile }: CoachingClientDashboardProps) => {
  const { signOut } = useAuth();
  const [currentView, setCurrentView] = useState<CoachingView>('overview');

  const menuItems = [
    { id: 'overview' as CoachingView, label: 'Home', icon: Home },
    { id: 'workout-plan' as CoachingView, label: 'La Mia Scheda', icon: ClipboardList, badge: 'Premium' },
    { id: 'calendar' as CoachingView, label: 'Calendario', icon: Calendar, badge: 'Premium' },
    { id: 'history' as CoachingView, label: 'Storico Schede', icon: History, badge: 'Premium' },
    { id: 'notes' as CoachingView, label: 'Le Mie Note', icon: StickyNote, badge: 'Premium' },
    { id: 'progress' as CoachingView, label: 'Progressi', icon: TrendingUp, badge: 'Premium' },
    { id: 'schedule' as CoachingView, label: 'Orari Palestra', icon: Clock },
    { id: 'courses' as CoachingView, label: 'Corsi', icon: Dumbbell },
    { id: 'documents' as CoachingView, label: 'I Miei Documenti', icon: FileText },
    { id: 'payments' as CoachingView, label: 'Storico Pagamenti', icon: CreditCard },
    { id: 'profile' as CoachingView, label: 'Dati Anagrafici', icon: User },
  ];

  const renderContent = () => {
    switch (currentView) {
      case 'overview':
        return <OverviewContent profile={profile} />;
      case 'workout-plan':
        return <WorkoutPlanContent />;
      case 'calendar':
        return <CalendarContent />;
      case 'notes':
        return <NotesContent />;
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
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-white" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Power Gym</h2>
                <p className="text-xs text-purple-500 font-medium">Coaching Premium</p>
              </div>
            </div>
          </div>
          
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>Menu Premium</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {menuItems.map((item) => (
                    <SidebarMenuItem key={item.id}>
                      <SidebarMenuButton 
                        onClick={() => setCurrentView(item.id)}
                        className={currentView === item.id ? 'bg-accent text-accent-foreground' : ''}
                      >
                        <item.icon className="h-4 w-4 mr-2" />
                        <span className="flex-1">{item.label}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="text-xs bg-purple-500/10 text-purple-500">
                            ⭐
                          </Badge>
                        )}
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
              <Badge className="bg-purple-500">Premium</Badge>
              <span className="text-sm text-muted-foreground">
                {profile?.full_name || 'Cliente'}
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
      <Card className="bg-gradient-to-r from-purple-500/10 to-purple-700/10 border-purple-500/20">
        <CardHeader>
          <CardTitle>Benvenuto, {profile?.full_name || 'Atleta'}! 🏆</CardTitle>
          <CardDescription>
            Hai accesso a tutte le funzionalità Premium del coaching personalizzato.
          </CardDescription>
        </CardHeader>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-purple-500" />
              Scheda Attiva
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">-</p>
            <p className="text-xs text-muted-foreground">Nessuna scheda assegnata</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calendar className="h-4 w-4 text-amber-500" />
              Prossimo Appuntamento
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">-</p>
            <p className="text-xs text-muted-foreground">Nessun appuntamento</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-red-500" />
              Scadenza Scheda
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">-</p>
            <p className="text-xs text-muted-foreground">Giorni rimanenti</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-500" />
              Ultimi Video
            </CardTitle>
            <CardDescription>I video degli esercizi della tua scheda</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              I video appariranno qui quando il coach assegnerà una scheda.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <StickyNote className="h-5 w-5 text-amber-500" />
              Note Recenti
            </CardTitle>
            <CardDescription>Le tue note personali</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Nessuna nota salvata. Inizia a prendere appunti!
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const WorkoutPlanContent = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>La Tua Scheda di Allenamento</CardTitle>
        <CardDescription>
          Qui troverai la scheda assegnata dal tuo coach con video dimostrativi.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Nessuna scheda assegnata. Il tuo coach la caricherà presto!
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const CalendarContent = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Il Tuo Calendario</CardTitle>
        <CardDescription>
          Visualizza appuntamenti, allenamenti completati e prossimi impegni.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <Calendar className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Il calendario sarà disponibile a breve.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

const NotesContent = () => {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Le Tue Note</CardTitle>
        <CardDescription>
          Spazio personale per appunti, osservazioni e promemoria.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-center py-12">
          <StickyNote className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-muted-foreground">
            Le note saranno disponibili a breve.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default CoachingClientDashboard;
