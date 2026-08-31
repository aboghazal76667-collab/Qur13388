import React from 'react';
import { View } from 'react-native';

import { theme } from '@dd/theme/tokens';
import { dictionaries } from '@dd/i18n/strings';
import { Button, Card, T } from './index';

type Props = { children: React.ReactNode; lang?: 'ar' | 'en' };
type State = { error: Error | null };

/**
 * Catches render errors so one broken screen never takes the app down mid-demo.
 * The stack trace is kept out of the customer's face — it goes to the dev
 * console only.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    if (__DEV__) console.error('[ErrorBoundary]', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    const t = dictionaries[this.props.lang ?? 'ar'];
    return (
      <View style={{ flex: 1, backgroundColor: theme.color.bg, padding: theme.space.lg, justifyContent: 'center' }}>
        <Card>
          <View style={{ gap: theme.space.md }}>
            <T variant="heading">{t['error.title']}</T>
            <T variant="small" color={theme.color.textMuted}>
              {t['error.body']}
            </T>
            <Button label={t['common.retry']} onPress={() => this.setState({ error: null })} />
          </View>
        </Card>
      </View>
    );
  }
}
