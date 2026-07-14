import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import {
  buildSandboxedMiniAppHtml,
  isAllowedMiniAppNavigation,
  parseMiniAppMessage,
} from './miniAppSandbox';

function HtmlMiniApp({ props, onAction }: { props: any, onAction: (action: string, data: any) => void }) {
  const html = buildSandboxedMiniAppHtml(String(props?.html ?? ''));
  const requestedHeight = Number(props?.height ?? 420);
  const height = Number.isFinite(requestedHeight)
    ? Math.max(260, Math.min(720, requestedHeight))
    : 420;

  const handleMessage = (event: WebViewMessageEvent) => {
    const parsed = parseMiniAppMessage(event.nativeEvent.data);
    if (parsed) onAction(parsed.action, parsed.data);
  };

  return (
    <View style={[styles.webviewCard, { height }]}>
      <WebView
        source={{ html, baseUrl: 'about:blank' }}
        originWhitelist={['about:blank']}
        onMessage={handleMessage}
        onShouldStartLoadWithRequest={(request) => isAllowedMiniAppNavigation(request.url)}
        javaScriptEnabled
        javaScriptCanOpenWindowsAutomatically={false}
        setSupportMultipleWindows={false}
        domStorageEnabled={false}
        cacheEnabled={false}
        incognito
        sharedCookiesEnabled={false}
        thirdPartyCookiesEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        mixedContentMode="never"
        allowsBackForwardNavigationGestures={false}
        allowsLinkPreview={false}
        dataDetectorTypes="none"
        pullToRefreshEnabled={false}
        bounces={false}
        style={styles.webview}
      />
    </View>
  );
}

export function GenUIRenderer({ payload, onAction }: { payload: any, onAction: (action: string, data: any) => void }) {
  const { component, props } = payload;

  if (component === 'Html' || component === 'HtmlMiniApp') {
    return <HtmlMiniApp props={props} onAction={onAction} />;
  }
  
  if (component === 'ApprovalCard') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>{props.title || "Approval Required"}</Text>
        {props.details && <Text style={styles.subtitle}>{props.details}</Text>}
        <View style={styles.row}>
          {(props.options || ['Approve', 'Reject']).map((opt: string) => (
            <TouchableOpacity 
              key={opt}
              style={[styles.btn, opt === 'Approve' ? styles.approveBtn : styles.secondaryBtn]} 
              onPress={() => onAction('approve_decision', { decision: opt })}
            >
              <Text style={opt === 'Approve' ? styles.approveText : styles.secondaryText}>{opt}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

  if (component === 'DataTable') {
    return (
      <View style={styles.card}>
        <View style={{flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#E2E8F0', paddingBottom: 8, marginBottom: 8}}>
          {(props.columns || []).map((col: string, i: number) => (
            <Text key={i} style={{flex: 1, fontWeight: '700', fontSize: 12, color: '#718096'}}>{col}</Text>
          ))}
        </View>
        {(props.rows || []).map((row: any[], i: number) => (
          <View key={i} style={{flexDirection: 'row', paddingVertical: 4}}>
            {row.map((cell: any, j: number) => (
              <Text key={j} style={{flex: 1, fontSize: 12, color: '#2D3748'}}>{cell}</Text>
            ))}
          </View>
        ))}
      </View>
    );
  }

  if (component === 'ExpenseApprover') {
    return (
      <View style={styles.card}>
        <Text style={styles.title}>Expense Approval</Text>
        <Text style={styles.subtitle}>Merchant: {props.merchant}</Text>
        <Text style={styles.amount}>${props.amount}</Text>
        
        <View style={styles.row}>
          <TouchableOpacity style={[styles.btn, styles.rejectBtn]} onPress={() => onAction('reject', props)}>
            <Text style={styles.rejectText}>Reject</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.btn, styles.approveBtn]} onPress={() => onAction('approve', props)}>
            <Text style={styles.approveText}>Approve</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (component === 'FlightDetails') {
    return (
      <View style={styles.card}>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12}}>
          <Text style={styles.title}>{props.airline || 'Airline'} • {props.flightNumber || '000'}</Text>
          <Text style={{fontWeight: '700', color: '#218380'}}>{props.status || 'On Time'}</Text>
        </View>
        <View style={{flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}}>
          <View>
            <Text style={{fontSize: 24, fontWeight: 'bold', color: '#2D3748'}}>{props.departure || 'LAX'}</Text>
            <Text style={{fontSize: 12, color: '#718096'}}>{props.depTime || '10:00 AM'}</Text>
          </View>
          <Text style={{fontSize: 20, color: '#E2E8F0'}}>✈️</Text>
          <View style={{alignItems: 'flex-end'}}>
            <Text style={{fontSize: 24, fontWeight: 'bold', color: '#2D3748'}}>{props.arrival || 'JFK'}</Text>
            <Text style={{fontSize: 12, color: '#718096'}}>{props.arrTime || '6:00 PM'}</Text>
          </View>
        </View>
        <TouchableOpacity style={[styles.btn, styles.approveBtn, {marginTop: 16}]} onPress={() => onAction('check_in', props)}>
          <Text style={styles.approveText}>Check In Now</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (component === 'InterventionCard') {
    return (
      <View style={styles.card}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#FEF3C7', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
          <Text style={{fontSize: 20}}>⚠️</Text>
        </View>
        <Text style={styles.title}>Action Required</Text>
        <Text style={styles.subtitle}>{props.message || 'The agent needs your input to continue.'}</Text>
        
        <TouchableOpacity style={[styles.btn, styles.approveBtn, {marginTop: 8}]} onPress={() => onAction('resolve', props)}>
          <Text style={styles.approveText}>{props.buttonText || 'Resolve'}</Text>
        </TouchableOpacity>
      </View>
    );
  }
  
  // Default fallback for unknown components
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{component}</Text>
      <Text style={styles.subtitle}>{JSON.stringify(props)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webviewCard: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#fff',
  },
  webview: { flex: 1, backgroundColor: '#fff' },
  card: { 
    backgroundColor: '#fff', 
    borderRadius: 20, 
    padding: 16, 
    width: '100%', 
    borderWidth: 1, 
    borderColor: '#E2E8F0', 
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 12,
    elevation: 3,
  },
  title: { fontSize: 16, fontWeight: '700', color: '#2D3748', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#718096', marginBottom: 12 },
  amount: { fontSize: 28, fontWeight: 'bold', color: '#3c6663', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  btn: { flex: 1, padding: 12, borderRadius: 12, alignItems: 'center' },
  rejectBtn: { backgroundColor: '#FEE2E2' },
  rejectText: { color: '#EF4444', fontWeight: '700' },
  approveBtn: { backgroundColor: '#3c6663' },
  approveText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' },
  secondaryText: { color: '#4A5568', fontWeight: '700' },
});
