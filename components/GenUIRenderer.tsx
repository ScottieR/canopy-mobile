import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

export function GenUIRenderer({ payload, onAction }: { payload: any, onAction: (action: string, data: any) => void }) {
  const { component, props } = payload;
  
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
});
