-- Índices parciales (Prisma no los soporta nativamente):
-- 1) Una sola plantilla activa por establecimiento
CREATE UNIQUE INDEX "CardTemplate_one_active_per_establishment"
  ON "CardTemplate" ("establishmentId") WHERE "isActive" = true;

-- 2) Un solo StampPoint principal (sin mozo) activo por establecimiento
CREATE UNIQUE INDEX "StampPoint_one_active_main_per_establishment"
  ON "StampPoint" ("establishmentId")
  WHERE "isActive" = true AND "memberId" IS NULL;
