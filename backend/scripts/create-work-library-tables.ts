// Work Library P0 — additive table creation on the live branch (schema drift makes
// `prisma db push` unsafe here; raw SQL adds without dropping). Idempotent.
// Run: npx tsx --env-file=.env scripts/create-work-library-tables.ts
import { prisma } from '../src/db/prisma.js';

const statements: string[] = [
  `CREATE TABLE IF NOT EXISTS public."WorkTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkTemplate_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES public."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "WorkTemplate_companyId_kind_idx" ON public."WorkTemplate"("companyId", "kind")`,

  `CREATE TABLE IF NOT EXISTS public."WorkTemplateKey" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "guidance" TEXT,
    "valueKind" TEXT NOT NULL DEFAULT 'TEXT',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "WorkTemplateKey_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "WorkTemplateKey_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."WorkTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "WorkTemplateKey_templateId_idx" ON public."WorkTemplateKey"("templateId")`,

  `CREATE TABLE IF NOT EXISTS public."NodeWorkTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "NodeWorkTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NodeWorkTemplate_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES public."ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NodeWorkTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."WorkTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "NodeWorkTemplate_processNodeId_templateId_key" ON public."NodeWorkTemplate"("processNodeId", "templateId")`,
  `CREATE INDEX IF NOT EXISTS "NodeWorkTemplate_processNodeId_idx" ON public."NodeWorkTemplate"("processNodeId")`,
  `CREATE INDEX IF NOT EXISTS "NodeWorkTemplate_templateId_idx" ON public."NodeWorkTemplate"("templateId")`,
  `CREATE INDEX IF NOT EXISTS "NodeWorkTemplate_companyId_processNodeId_idx" ON public."NodeWorkTemplate"("companyId", "processNodeId")`,

  `CREATE TABLE IF NOT EXISTS public."StandardWorkTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "StandardWorkTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StandardWorkTemplate_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES public."Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StandardWorkTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."WorkTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StandardWorkTemplate_standardId_templateId_key" ON public."StandardWorkTemplate"("standardId", "templateId")`,
  `CREATE INDEX IF NOT EXISTS "StandardWorkTemplate_standardId_idx" ON public."StandardWorkTemplate"("standardId")`,
  `CREATE INDEX IF NOT EXISTS "StandardWorkTemplate_templateId_idx" ON public."StandardWorkTemplate"("templateId")`,
  `CREATE INDEX IF NOT EXISTS "StandardWorkTemplate_companyId_standardId_idx" ON public."StandardWorkTemplate"("companyId", "standardId")`,

  `CREATE TABLE IF NOT EXISTS public."RegulationWorkTemplate" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    CONSTRAINT "RegulationWorkTemplate_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RegulationWorkTemplate_regId_fkey" FOREIGN KEY ("regId") REFERENCES public."RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegulationWorkTemplate_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES public."WorkTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RegulationWorkTemplate_regId_templateId_key" ON public."RegulationWorkTemplate"("regId", "templateId")`,
  `CREATE INDEX IF NOT EXISTS "RegulationWorkTemplate_regId_idx" ON public."RegulationWorkTemplate"("regId")`,
  `CREATE INDEX IF NOT EXISTS "RegulationWorkTemplate_templateId_idx" ON public."RegulationWorkTemplate"("templateId")`,
  `CREATE INDEX IF NOT EXISTS "RegulationWorkTemplate_companyId_regId_idx" ON public."RegulationWorkTemplate"("companyId", "regId")`,

  `CREATE TABLE IF NOT EXISTS public."NodeTemplateAnswer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "templateKeyId" TEXT,
    "customKey" TEXT,
    "kind" TEXT,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NodeTemplateAnswer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NodeTemplateAnswer_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES public."ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NodeTemplateAnswer_templateKeyId_fkey" FOREIGN KEY ("templateKeyId") REFERENCES public."WorkTemplateKey"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NodeTemplateAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public."Application"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NodeTemplateAnswer_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NodeTemplateAnswer_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES public."Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "NodeTemplateAnswer_processNodeId_templateKeyId_key" ON public."NodeTemplateAnswer"("processNodeId", "templateKeyId")`,
  `CREATE INDEX IF NOT EXISTS "NodeTemplateAnswer_processNodeId_idx" ON public."NodeTemplateAnswer"("processNodeId")`,
  `CREATE INDEX IF NOT EXISTS "NodeTemplateAnswer_templateKeyId_idx" ON public."NodeTemplateAnswer"("templateKeyId")`,
  `CREATE INDEX IF NOT EXISTS "NodeTemplateAnswer_companyId_processNodeId_idx" ON public."NodeTemplateAnswer"("companyId", "processNodeId")`,

  `CREATE TABLE IF NOT EXISTS public."StandardTemplateAnswer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "templateKeyId" TEXT,
    "customKey" TEXT,
    "kind" TEXT,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StandardTemplateAnswer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StandardTemplateAnswer_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES public."Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StandardTemplateAnswer_templateKeyId_fkey" FOREIGN KEY ("templateKeyId") REFERENCES public."WorkTemplateKey"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StandardTemplateAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public."Application"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StandardTemplateAnswer_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StandardTemplateAnswer_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES public."Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "StandardTemplateAnswer_standardId_templateKeyId_key" ON public."StandardTemplateAnswer"("standardId", "templateKeyId")`,
  `CREATE INDEX IF NOT EXISTS "StandardTemplateAnswer_standardId_idx" ON public."StandardTemplateAnswer"("standardId")`,
  `CREATE INDEX IF NOT EXISTS "StandardTemplateAnswer_templateKeyId_idx" ON public."StandardTemplateAnswer"("templateKeyId")`,
  `CREATE INDEX IF NOT EXISTS "StandardTemplateAnswer_companyId_standardId_idx" ON public."StandardTemplateAnswer"("companyId", "standardId")`,

  `CREATE TABLE IF NOT EXISTS public."RegulationTemplateAnswer" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "templateKeyId" TEXT,
    "customKey" TEXT,
    "kind" TEXT,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "suppressed" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RegulationTemplateAnswer_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RegulationTemplateAnswer_regId_fkey" FOREIGN KEY ("regId") REFERENCES public."RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegulationTemplateAnswer_templateKeyId_fkey" FOREIGN KEY ("templateKeyId") REFERENCES public."WorkTemplateKey"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RegulationTemplateAnswer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public."Application"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegulationTemplateAnswer_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "RegulationTemplateAnswer_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES public."Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "RegulationTemplateAnswer_regId_templateKeyId_key" ON public."RegulationTemplateAnswer"("regId", "templateKeyId")`,
  `CREATE INDEX IF NOT EXISTS "RegulationTemplateAnswer_regId_idx" ON public."RegulationTemplateAnswer"("regId")`,
  `CREATE INDEX IF NOT EXISTS "RegulationTemplateAnswer_templateKeyId_idx" ON public."RegulationTemplateAnswer"("templateKeyId")`,
  `CREATE INDEX IF NOT EXISTS "RegulationTemplateAnswer_companyId_regId_idx" ON public."RegulationTemplateAnswer"("companyId", "regId")`,

  `CREATE TABLE IF NOT EXISTS public."NodeStandardEvidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "standardId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NodeStandardEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NodeStandardEvidence_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES public."ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NodeStandardEvidence_standardId_fkey" FOREIGN KEY ("standardId") REFERENCES public."Standard"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NodeStandardEvidence_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public."Application"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NodeStandardEvidence_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NodeStandardEvidence_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES public."Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "NodeStandardEvidence_processNodeId_idx" ON public."NodeStandardEvidence"("processNodeId")`,
  `CREATE INDEX IF NOT EXISTS "NodeStandardEvidence_standardId_idx" ON public."NodeStandardEvidence"("standardId")`,
  `CREATE INDEX IF NOT EXISTS "NodeStandardEvidence_companyId_processNodeId_idx" ON public."NodeStandardEvidence"("companyId", "processNodeId")`,

  `CREATE TABLE IF NOT EXISTS public."NodeRegulationEvidence" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "processNodeId" TEXT NOT NULL,
    "regId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "step" TEXT NOT NULL,
    "value" TEXT,
    "applicationId" TEXT,
    "roleId" TEXT,
    "deliverableId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NodeRegulationEvidence_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "NodeRegulationEvidence_processNodeId_fkey" FOREIGN KEY ("processNodeId") REFERENCES public."ProcessNode"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NodeRegulationEvidence_regId_fkey" FOREIGN KEY ("regId") REFERENCES public."RegulatoryRequirement"("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "NodeRegulationEvidence_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES public."Application"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NodeRegulationEvidence_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES public."Role"("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "NodeRegulationEvidence_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES public."Deliverable"("id") ON DELETE SET NULL ON UPDATE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS "NodeRegulationEvidence_processNodeId_idx" ON public."NodeRegulationEvidence"("processNodeId")`,
  `CREATE INDEX IF NOT EXISTS "NodeRegulationEvidence_regId_idx" ON public."NodeRegulationEvidence"("regId")`,
  `CREATE INDEX IF NOT EXISTS "NodeRegulationEvidence_companyId_processNodeId_idx" ON public."NodeRegulationEvidence"("companyId", "processNodeId")`,
];

async function main() {
  for (const sql of statements) {
    await prisma.$executeRawUnsafe(sql);
  }
  const tables = await prisma.$queryRawUnsafe<{ table_name: string }[]>(
    `SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN
     ('WorkTemplate','WorkTemplateKey','NodeWorkTemplate','StandardWorkTemplate','RegulationWorkTemplate',
      'NodeTemplateAnswer','StandardTemplateAnswer','RegulationTemplateAnswer','NodeStandardEvidence','NodeRegulationEvidence')
     ORDER BY table_name`
  );
  console.log(`created/verified ${tables.length}/10 tables:`);
  for (const t of tables) console.log('  -', t.table_name);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
