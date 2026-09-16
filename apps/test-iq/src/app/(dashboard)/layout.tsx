'use client';

import { useState, createContext, useContext, useMemo, useEffect, useCallback } from 'react';
import Sidebar from '@/components/dtq/Sidebar';
import { PersonaType } from '@/lib/dtq/types';
import { ChatProvider } from '@/contexts/ChatContext';
import { NavigationProvider } from '@/contexts/NavigationContext';
import ChatWidget from '@/components/dtq/ChatWidget';

interface PersonaContextType {
  persona: PersonaType;
  setPersona: (persona: PersonaType) => void;
}

const PersonaContext = createContext<PersonaContextType>({
  persona: 'manager',
  setPersona: () => {},
});

export const usePersona = () => useContext(PersonaContext);

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [persona, updatePersona] = useState<PersonaType>('manager');
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('dtq-demo-persona');
      if (saved === 'csuite' || saved === 'manager' || saved === 'techlead') queueMicrotask(() => updatePersona(saved));
    } catch { /* Demo remains usable when browser storage is unavailable. */ }
  }, []);
  const setPersona = useCallback((next: PersonaType) => {
    updatePersona(next);
    try { sessionStorage.setItem('dtq-demo-persona', next); } catch { /* Session-only preference. */ }
  }, []);
  const contextValue = useMemo(() => ({ persona, setPersona }), [persona, setPersona]);

  return (
    <PersonaContext.Provider value={contextValue}>
      <ChatProvider>
        <NavigationProvider>
          <div className="flex min-h-screen" style={{ background: 'var(--bg-primary)' }}>
            <Sidebar persona={persona} onPersonaChange={setPersona} />
            <main className="flex-1 overflow-auto">
              <div className="p-6 lg:p-8">
                {children}
              </div>
            </main>
          </div>
          <ChatWidget />
        </NavigationProvider>
      </ChatProvider>
    </PersonaContext.Provider>
  );
}
