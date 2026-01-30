import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import AdminDashboard from '@/components/dashboards/AdminDashboard';
import GymClientDashboard from '@/components/dashboards/GymClientDashboard';
import CoachingClientDashboard from '@/components/dashboards/CoachingClientDashboard';
import { Loader2 } from 'lucide-react';

const Dashboard = () => {
  const { user, userRole, loading, profile } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Render dashboard basato sul ruolo
  switch (userRole) {
    case 'admin':
      return <AdminDashboard />;
    case 'coaching_client':
      return <CoachingClientDashboard profile={profile} />;
    case 'gym_client':
    default:
      return <GymClientDashboard profile={profile} />;
  }
};

export default Dashboard;
