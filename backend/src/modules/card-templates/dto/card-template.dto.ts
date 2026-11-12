import { z } from 'zod';

export const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color en formato #RRGGBB');
export const stampIconKeys = ['coffee', 'beer', 'star', 'cocktail', 'heart', 'pizza', 'burger', 'sun'] as const;

export const CardTemplateDto = z
  .object({
    name: z.string().trim().min(2).max(80).optional(),
    stampsRequired: z.number().int().min(3, 'Mínimo 3 sellos').max(50, 'Máximo 50 sellos'),
    rewardTitle: z.string().trim().min(2, 'Contá qué se gana').max(120),
    rewardDescription: z.string().trim().max(300).optional().nullable(),
    rewardValidDays: z.number().int().min(1).max(365).optional().nullable(),
    logoUrl: z.string().url().max(1000).optional().nullable(),
    backgroundColor: hexColor.default('#1F2937'),
    backgroundImageUrl: z.string().url().max(1000).optional().nullable(),
    textColor: hexColor.default('#FFFFFF'),
    accentColor: hexColor.default('#F59E0B'),
    stampIconKey: z.enum(stampIconKeys).optional().nullable(),
    stampIconUrl: z.string().url().max(1000).optional().nullable(),
    emptySlotStyle: z.enum(['outline', 'dotted', 'filled']).default('outline'),
    layout: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();
export type CardTemplateDto = z.infer<typeof CardTemplateDto>;

export const DEFAULT_TEMPLATE: CardTemplateDto = {
  stampsRequired: 10,
  rewardTitle: 'Premio del local',
  backgroundColor: '#1F2937',
  textColor: '#FFFFFF',
  accentColor: '#F59E0B',
  emptySlotStyle: 'outline',
  stampIconKey: 'star',
};