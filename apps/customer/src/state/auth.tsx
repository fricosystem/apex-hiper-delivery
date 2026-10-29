import { createContext, use, useEffect, useState, type ReactNode } from 'react';
import type { UserProfileInput } from '@hiper/shared';
import { data, type SessionUser } from '@/data';

interface AuthState {
  /** undefined enquanto o Firebase ainda restaura a sessão. */
  user: SessionUser | null | undefined;
  profile: UserProfileInput | null;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: undefined,
  profile: null,
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [profile, setProfile] = useState<UserProfileInput | null>(null);

  useEffect(
    () =>
      data().onAuthChanged((u) => {
        setUser(u);
        if (!u) setProfile(null);
        else
          void data()
            .getProfile(u.uid)
            .then(setProfile)
            .catch(() => setProfile(null));
      }),
    [],
  );

  const refreshProfile = async () => {
    if (user) setProfile(await data().getProfile(user.uid));
  };

  return <AuthContext value={{ user, profile, refreshProfile }}>{children}</AuthContext>;
}

export function useAuth(): AuthState {
  return use(AuthContext);
}
