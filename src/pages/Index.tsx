import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Zap, Info, Users } from 'lucide-react';

const Index = () => {
  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-b from-slate-950 via-purple-950 to-slate-950">
      {/* Grid overlay */}
      <div 
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: `
            linear-gradient(to right, rgba(168, 85, 247, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(168, 85, 247, 0.1) 1px, transparent 1px)
          `,
          backgroundSize: '50px 50px',
          transform: 'perspective(500px) rotateX(60deg)',
          transformOrigin: 'center top',
        }}
      />
      
      {/* Glow effect */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/20 rounded-full blur-3xl" />
      
      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        {/* Logo */}
        <div className="mb-8">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-600 blur-2xl opacity-50 animate-pulse" />
            <div className="relative w-32 h-32 bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600 rounded-full flex items-center justify-center shadow-2xl">
              <Zap className="h-16 w-16 text-slate-950" />
            </div>
          </div>
        </div>

        {/* Title */}
        <p className="text-purple-300 tracking-[0.5em] text-sm mb-4 uppercase">Calisthenics</p>
        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-300 via-amber-400 to-amber-600 mb-2">
          POWER
        </h1>
        <h2 className="text-5xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-400 to-amber-700 mb-12">
          GYM
        </h2>

        {/* Navigation Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">
          <Link to="/auth" className="flex-1">
            <Button 
              size="lg" 
              className="w-full h-20 text-lg font-bold bg-gradient-to-r from-purple-600 to-purple-800 hover:from-purple-700 hover:to-purple-900 border border-purple-500/50 shadow-lg shadow-purple-500/25"
            >
              <Users className="mr-3 h-6 w-6" />
              <div className="text-left">
                <div>AREA CLIENTI</div>
                <div className="text-xs font-normal opacity-75">Accedi al tuo profilo</div>
              </div>
            </Button>
          </Link>

          <a href="https://superpowegym.it/" target="_blank" rel="noopener noreferrer" className="flex-1">
            <Button 
              size="lg" 
              variant="outline"
              className="w-full h-20 text-lg font-bold border-amber-500/50 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300 shadow-lg shadow-amber-500/10"
            >
              <Info className="mr-3 h-6 w-6" />
              <div className="text-left">
                <div>INFO & CONTATTI</div>
                <div className="text-xs font-normal opacity-75">Scopri la palestra</div>
              </div>
            </Button>
          </a>
        </div>
      </div>

      {/* Bottom gradient */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-950 to-transparent" />
    </div>
  );
};

export default Index;
