import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, ScrollView, TextInput, ActivityIndicator, Alert, StyleSheet } from 'react-native';
import { OfficeHours } from '../services/api';
import { SarahContactsModal } from './SarahContactsModal';

// Object.keys(localOfficeHours) follows insertion order of whatever was last saved,
// not necessarily Monday->Sunday — this fixed order keeps the grid always rendering
// Segunda through Domingo regardless of how the underlying object was built.
const DAY_ORDER = ['segunda', 'terca', 'quarta', 'quinta', 'sexta', 'sabado', 'domingo'];

const DAY_LABEL_MAP: Record<string, string> = {
  segunda: 'Segunda',
  terca: 'Terça',
  quarta: 'Quarta',
  quinta: 'Quinta',
  sexta: 'Sexta',
  sabado: 'Sábado',
  domingo: 'Domingo'
};

const TIME_SLOTS = ['08:00', '09:00', '10:00', '11:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00', '19:00', '20:00'];

const HOUR_FORMAT_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

interface AISettingsModalProps {
  visible: boolean;
  onClose: () => void;
  aiSettings: {
    enabled: boolean;
    instructions: string;
    officeHours: OfficeHours;
    receiveWeeklyReport: boolean;
    weeklyReportDay: string;
    weeklyReportTime: string;
    loading: boolean;
    saveSettings: (
      enabled: boolean,
      instructions: string,
      officeHours: OfficeHours,
      receiveWeeklyReport: boolean,
      weeklyReportDay: string,
      weeklyReportTime: string
    ) => Promise<boolean>;
  };
}

export function AISettingsModal({ visible, onClose, aiSettings }: AISettingsModalProps) {
  const [localEnabled, setLocalEnabled] = useState(aiSettings.enabled);
  const [localInstructions, setLocalInstructions] = useState(aiSettings.instructions);
  const [localOfficeHours, setLocalOfficeHours] = useState<OfficeHours>(aiSettings.officeHours);
  const [localReceiveWeeklyReport, setLocalReceiveWeeklyReport] = useState(aiSettings.receiveWeeklyReport);
  const [localWeeklyReportDay, setLocalWeeklyReportDay] = useState(aiSettings.weeklyReportDay);
  const [localWeeklyReportTime, setLocalWeeklyReportTime] = useState(aiSettings.weeklyReportTime);
  const [saving, setSaving] = useState(false);
  const [showContactsBlockModal, setShowContactsBlockModal] = useState(false);
  const [customHourInput, setCustomHourInput] = useState<Record<string, string>>({});
  const [customHourError, setCustomHourError] = useState<Record<string, boolean>>({});

  // Sync draft state with hook state only on the visible=false->true transition.
  // useAISettings() returns a brand-new object on every DashboardScreen render, so
  // depending on `aiSettings` here (instead of just `visible`) re-ran this effect on
  // every parent re-render while the modal was open, silently reverting any edit the
  // user had just made (looked like "can't select more than one time slot").
  useEffect(() => {
    if (visible) {
      setLocalEnabled(aiSettings.enabled);
      setLocalInstructions(aiSettings.instructions);
      setLocalOfficeHours(JSON.parse(JSON.stringify(aiSettings.officeHours))); // deep copy
      setLocalReceiveWeeklyReport(aiSettings.receiveWeeklyReport);
      setLocalWeeklyReportDay(aiSettings.weeklyReportDay);
      setLocalWeeklyReportTime(aiSettings.weeklyReportTime);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: only resync on the
    // visible transition, not on every aiSettings identity change while the modal stays open.
  }, [visible]);

  const handleToggleHourSlot = (day: string, hour: string) => {
    setLocalOfficeHours(current => {
      const slots = current[day] || [];
      const newSlots = slots.includes(hour)
        ? slots.filter(h => h !== hour)
        : [...slots, hour].sort();
      return { ...current, [day]: newSlots };
    });
  };

  // Idempotent add for the custom-time input below — unlike handleToggleHourSlot,
  // confirming a time that's already selected must not remove it.
  const handleAddCustomHourSlot = (day: string) => {
    const raw = (customHourInput[day] || '').trim();
    if (!HOUR_FORMAT_REGEX.test(raw)) {
      setCustomHourError(current => ({ ...current, [day]: true }));
      return;
    }
    setLocalOfficeHours(current => {
      const slots = current[day] || [];
      if (slots.includes(raw)) return current;
      return { ...current, [day]: [...slots, raw].sort() };
    });
    setCustomHourInput(current => ({ ...current, [day]: '' }));
    setCustomHourError(current => ({ ...current, [day]: false }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const success = await aiSettings.saveSettings(
        localEnabled,
        localInstructions,
        localOfficeHours,
        localReceiveWeeklyReport,
        localWeeklyReportDay,
        localWeeklyReportTime
      );
      if (success) {
        Alert.alert('Sucesso', 'Configurações da Secretária de IA salvas com sucesso!');
        onClose();
      }
    } catch (e) {
      Alert.alert('Erro', 'Falha ao salvar configurações.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.calPickerOverlay}>
        <View style={styles.calPickerContainer}>
          <View style={styles.calPickerHeader}>
            <Text style={styles.calPickerTitle}>⚙️ Configuração da Secretária Sarah</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.calPickerCloseBtn}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <ScrollView style={{ maxHeight: 500, width: '100%' }} showsVerticalScrollIndicator={false} nestedScrollEnabled={true}>
            <Text style={styles.sectionSubtitle}>✍️ Regras & Personalidade</Text>
            <Text style={styles.gridInstruction}>
              Escreva as regras que a Sarah deve seguir ao responder autonomamente aos clientes pelo WhatsApp:
            </Text>
            <TextInput
              style={styles.aiInstructionsInput}
              multiline
              numberOfLines={6}
              value={localInstructions}
              onChangeText={setLocalInstructions}
              placeholder="Ex: Você é a Secretária Virtual do Rodrigo Sonsino. Seja sempre prestativa, use emojis simpáticos..."
            />

            <Text style={[styles.sectionSubtitle, { marginTop: 20 }]}>🕒 Horários de Atendimento Disponíveis</Text>
            <Text style={styles.gridInstruction}>
              Selecione os dias e horários em que a Sarah poderá agendar sessões (toque para ativar/desativar):
            </Text>

            {DAY_ORDER.map(day => {
              const activeHours = localOfficeHours[day] || [];
              const allSlotsForDay = Array.from(new Set([...TIME_SLOTS, ...activeHours])).sort();

              return (
                <View key={day} style={styles.gridDayRow}>
                  <Text style={styles.gridDayLabel}>{DAY_LABEL_MAP[day] || day}</Text>
                  <View style={styles.gridHoursWrap}>
                    {allSlotsForDay.map(hour => {
                      const isSelected = activeHours.includes(hour);
                      return (
                        <TouchableOpacity
                          key={hour}
                          style={[styles.gridHourBtn, isSelected && styles.gridHourBtnActive]}
                          onPress={() => handleToggleHourSlot(day, hour)}
                          accessibilityRole="button"
                          accessibilityState={{ selected: isSelected }}
                        >
                          <Text style={[styles.gridHourText, isSelected && styles.gridHourTextActive]}>
                            {hour}
                          </Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={styles.customHourRow}>
                    <TextInput
                      style={[styles.customHourInput, customHourError[day] && styles.customHourInputError]}
                      placeholder="hh:mm"
                      maxLength={5}
                      inputMode="numeric"
                      autoCorrect={false}
                      accessibilityLabel={`Horário customizado para ${DAY_LABEL_MAP[day] || day}`}
                      value={customHourInput[day] || ''}
                      onChangeText={(text) => {
                        setCustomHourInput(current => ({ ...current, [day]: text }));
                        if (customHourError[day]) setCustomHourError(current => ({ ...current, [day]: false }));
                      }}
                      onSubmitEditing={() => handleAddCustomHourSlot(day)}
                    />
                    <TouchableOpacity
                      style={styles.customHourAddBtn}
                      onPress={() => handleAddCustomHourSlot(day)}
                      accessibilityRole="button"
                      accessibilityLabel={`Adicionar horário customizado para ${DAY_LABEL_MAP[day] || day}`}
                    >
                      <Text style={styles.customHourAddBtnText}>+</Text>
                    </TouchableOpacity>
                    {customHourError[day] && (
                      <Text style={styles.customHourErrorText}>Formato inválido, use hh:mm</Text>
                    )}
                  </View>
                </View>
              );
            })}

            <Text style={[styles.sectionSubtitle, { marginTop: 20 }]}>🔇 Contatos silenciados</Text>
            <Text style={styles.gridInstruction}>
              Escolha contatos específicos (ex: familiares) que a Sarah nunca deve responder automaticamente.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton, { marginTop: 8 }]}
              onPress={() => setShowContactsBlockModal(true)}
            >
              <Text style={styles.buttonText}>Gerenciar contatos silenciados</Text>
            </TouchableOpacity>
          </ScrollView>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 20 }}>
            <TouchableOpacity 
              style={[styles.button, styles.cancelButton, { flex: 1, marginRight: 10 }]} 
              onPress={onClose}
            >
              <Text style={styles.buttonText}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, { flex: 1, backgroundColor: '#4F46E5', justifyContent: 'center', alignItems: 'center', borderRadius: 10 }]} 
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={[styles.buttonText, { color: '#fff' }]}>Salvar Tudo</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <SarahContactsModal
        visible={showContactsBlockModal}
        onClose={() => setShowContactsBlockModal(false)}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  calPickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  calPickerContainer: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 20,
    width: '100%',
    maxWidth: 550,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  calPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  calPickerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1E293B',
  },
  calPickerCloseBtn: {
    fontSize: 20,
    color: '#64748B',
    fontWeight: '700',
    padding: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 6,
  },
  gridInstruction: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 12,
  },
  aiInstructionsInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 12,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    textAlignVertical: 'top',
    marginBottom: 10,
  },
  gridDayRow: {
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 8,
  },
  gridDayLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 6,
  },
  gridHoursWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  gridHourBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#F1F5F9',
    marginRight: 6,
    marginBottom: 6,
  },
  gridHourBtnActive: {
    backgroundColor: '#E0E7FF',
  },
  gridHourText: {
    fontSize: 12,
    color: '#64748B',
    fontWeight: '600',
  },
  gridHourTextActive: {
    color: '#4F46E5',
  },
  customHourRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginTop: 6,
  },
  customHourInput: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    width: 64,
  },
  customHourInputError: {
    borderColor: '#DC2626',
  },
  customHourAddBtn: {
    marginLeft: 6,
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  customHourAddBtnText: {
    color: '#4F46E5',
    fontSize: 16,
    fontWeight: '700',
  },
  customHourErrorText: {
    fontSize: 11,
    color: '#DC2626',
    marginLeft: 8,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
});
