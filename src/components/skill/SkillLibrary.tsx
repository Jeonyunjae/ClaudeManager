'use client';

import React, { useEffect } from 'react';
import { useSkillStore } from '@/stores/skillStore';
import { Card, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

export function SkillLibrary() {
  const { skills, fetchSkills, selectSkill } = useSkillStore();

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  if (skills.length === 0) {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-[var(--text-tertiary)]">
        등록된 Skill이 없습니다.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {skills.map((skill) => (
        <Card
          key={skill.name}
          className="cursor-pointer hover:shadow-[var(--shadow-md)] transition-shadow"
          onClick={() => selectSkill(skill)}
        >
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm">{skill.displayName}</CardTitle>
              <Badge variant="idle">{skill.version}</Badge>
            </div>
            <CardDescription className="text-xs">{skill.description}</CardDescription>
            {skill.parentSkill && (
              <p className="text-[10px] text-[var(--text-tertiary)] mt-1">
                Inherits: {skill.parentSkill}
              </p>
            )}
          </CardHeader>
        </Card>
      ))}
    </div>
  );
}
