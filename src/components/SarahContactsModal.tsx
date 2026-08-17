import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { View, Text, Modal, TextInput, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Switch } from 'react-native';
import { WhatsappContact, getWhatsappContacts, setContactAiBlock } from '../services/api';

interface SarahContactsModalProps {
  visible: boolean;
  onClose: () => void;
}

export function SarahContactsModal({ visible, onClose }: SarahContactsModalProps) {
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<WhatsappContact[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  // IDs de contato com um PATCH em voo — usado pra desabilitar o switch e
  // evitar dois toggles concorrentes no mesmo contato ficarem fora de ordem.
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set());

  const fetchContacts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getWhatsappContacts();
      setContacts(data);
    } catch (error) {
      console.log('Erro ao buscar contatos para configuração da Sarah:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      fetchContacts();
    }
  }, [visible, fetchContacts]);

  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter(c => c.name.toLowerCase().includes(q) || c.id.includes(q));
  }, [contacts, searchQuery]);

  const handleToggle = async (contact: WhatsappContact, newValue: boolean) => {
    if (pendingIds.has(contact.id)) return;

    setPendingIds(prev => new Set(prev).add(contact.id));
    // Atualização otimista — revertida abaixo se o PATCH falhar.
    setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, aiPermanentlyDisabled: newValue } : c));

    try {
      const result = await setContactAiBlock(contact.id, newValue);
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, aiPermanentlyDisabled: result.aiPermanentlyDisabled } : c));
    } catch (error) {
      console.log('Erro ao atualizar bloqueio da Sarah para o contato:', error);
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, aiPermanentlyDisabled: !newValue } : c));
    } finally {
      setPendingIds(prev => {
        const next = new Set(prev);
        next.delete(contact.id);
        return next;
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={true}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalView}>
          <Text style={styles.modalTitle}>Contatos silenciados</Text>
          <Text style={styles.modalSubtitle}>
            Contatos com o toggle ativado nunca recebem resposta automática da Sarah,
            mesmo que mandem mensagem para este número.
          </Text>

          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Buscar contato..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus={Platform.OS === 'web'}
          />

          {loading ? (
            <ActivityIndicator size="large" color="#25D366" style={{ marginVertical: 20 }} />
          ) : (
            <FlatList
              data={filteredContacts}
              keyExtractor={item => item.id}
              renderItem={({ item }) => (
                <View style={styles.contactRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName}>{item.name}</Text>
                    <Text style={styles.contactId}>{item.id}</Text>
                  </View>
                  {pendingIds.has(item.id) ? (
                    <ActivityIndicator size="small" color="#25D366" />
                  ) : (
                    <Switch
                      value={item.aiPermanentlyDisabled === true}
                      onValueChange={(newValue) => handleToggle(item, newValue)}
                      trackColor={{ false: '#334155', true: '#DC2626' }}
                      thumbColor="#F8FAFC"
                    />
                  )}
                </View>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>Nenhum contato encontrado.</Text>
              }
              style={{ maxHeight: 350 }}
            />
          )}

          <TouchableOpacity
            style={[styles.button, styles.cancelButton, { marginTop: 15, width: '100%' }]}
            onPress={onClose}
          >
            <Text style={styles.buttonText}>Fechar</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.75)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalView: {
    width: '90%',
    maxWidth: 420,
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 6,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    marginBottom: 16,
  },
  searchInput: {
    height: 44,
    borderWidth: 1,
    borderColor: '#334155',
    borderRadius: 8,
    paddingHorizontal: 12,
    fontSize: 15,
    backgroundColor: '#0F172A',
    color: '#F8FAFC',
    marginBottom: 16,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#334155',
    backgroundColor: '#1E293B',
  },
  contactName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  contactId: {
    fontSize: 12,
    color: '#94A3B8',
  },
  emptyText: {
    textAlign: 'center',
    color: '#94A3B8',
    fontSize: 15,
    marginTop: 20,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  cancelButton: {
    backgroundColor: '#334155',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
