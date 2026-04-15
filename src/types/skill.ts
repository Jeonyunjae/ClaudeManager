export type SkillFieldType = 'text' | 'select' | 'number';

export type SkillField = {
  key: string;
  label: string;
  type: SkillFieldType;
  required: boolean;
  default?: string | number;
  options?: string[];
};

export type SkillSchema = {
  name: string;
  version: string;
  schema: {
    fields: SkillField[];
  };
};

export type Skill = {
  name: string;
  displayName: string;
  description?: string;
  version: string;
  parentSkill?: string;
  filePath: string;
  createdAt: string;
};
