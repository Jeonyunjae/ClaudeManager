'use client';

import React, { useEffect } from 'react';
import { Modal, ModalContent, ModalHeader, ModalTitle } from '@/components/ui/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSkillStore } from '@/stores/skillStore';

export function SkillFormModal() {
  const { selectedSkill, schema, formData, fetchSchema, setFormField, execute } = useSkillStore();

  useEffect(() => {
    if (selectedSkill) {
      fetchSchema(selectedSkill.name);
    }
  }, [selectedSkill, fetchSchema]);

  if (!selectedSkill) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedSkill) execute(selectedSkill.name);
  };

  return (
    <Modal open={!!selectedSkill} onOpenChange={(open) => { if (!open) useSkillStore.getState().selectSkill(null); }}>
      <ModalContent size="md">
        <ModalHeader>
          <ModalTitle>Execute: {selectedSkill.displayName}</ModalTitle>
        </ModalHeader>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 pb-6">
          <p className="text-sm text-[var(--text-secondary)]">{selectedSkill.description}</p>

          {schema?.schema?.fields?.map((field) => (
            <div key={field.key} className="space-y-1">
              <label className="text-xs font-medium text-[var(--text-secondary)]">
                {field.label}
                {field.required && <span className="text-[var(--status-error)] ml-0.5">*</span>}
              </label>
              {field.type === 'select' ? (
                <select
                  value={String(formData[field.key] ?? field.default ?? '')}
                  onChange={(e) => setFormField(field.key, e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-[var(--radius-md)] border border-[var(--primary-100)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--primary-300)]"
                >
                  <option value="">Select...</option>
                  {field.options?.map((opt: string) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <Input
                  type={field.type === 'number' ? 'number' : 'text'}
                  value={String(formData[field.key] ?? '')}
                  onChange={(e) => setFormField(field.key, e.target.value)}
                  placeholder={field.label}
                />
              )}
            </div>
          ))}

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={() => useSkillStore.getState().selectSkill(null)}
            >
              Cancel
            </Button>
            <Button type="submit">Execute</Button>
          </div>
        </form>
      </ModalContent>
    </Modal>
  );
}
