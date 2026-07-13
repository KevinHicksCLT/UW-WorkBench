-- CreateTable
CREATE TABLE "ProductLevelType" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "levelNumber" INTEGER NOT NULL,
    "dbValue" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductLevelType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductNode" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "productLevelTypeId" TEXT NOT NULL,
    "parentId" TEXT,
    "dbValue" TEXT NOT NULL,
    "displayValue" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "code" TEXT,
    "attributes" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductNodeClosure" (
    "ancestorId" TEXT NOT NULL,
    "descendantId" TEXT NOT NULL,
    "depth" INTEGER NOT NULL,

    CONSTRAINT "ProductNodeClosure_pkey" PRIMARY KEY ("ancestorId","descendantId")
);

-- CreateIndex
CREATE INDEX "ProductLevelType_companyId_idx" ON "ProductLevelType"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "ProductLevelType_companyId_levelNumber_key" ON "ProductLevelType"("companyId", "levelNumber");

-- CreateIndex
CREATE INDEX "ProductNode_companyId_productLevelTypeId_idx" ON "ProductNode"("companyId", "productLevelTypeId");

-- CreateIndex
CREATE INDEX "ProductNode_parentId_idx" ON "ProductNode"("parentId");

-- CreateIndex
CREATE INDEX "ProductNodeClosure_descendantId_depth_idx" ON "ProductNodeClosure"("descendantId", "depth");

-- CreateIndex
CREATE INDEX "ProductNodeClosure_ancestorId_depth_idx" ON "ProductNodeClosure"("ancestorId", "depth");

-- AddForeignKey
ALTER TABLE "ProductLevelType" ADD CONSTRAINT "ProductLevelType_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductNode" ADD CONSTRAINT "ProductNode_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductNode" ADD CONSTRAINT "ProductNode_productLevelTypeId_fkey" FOREIGN KEY ("productLevelTypeId") REFERENCES "ProductLevelType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductNode" ADD CONSTRAINT "ProductNode_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ProductNode"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductNodeClosure" ADD CONSTRAINT "ProductNodeClosure_ancestorId_fkey" FOREIGN KEY ("ancestorId") REFERENCES "ProductNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductNodeClosure" ADD CONSTRAINT "ProductNodeClosure_descendantId_fkey" FOREIGN KEY ("descendantId") REFERENCES "ProductNode"("id") ON DELETE CASCADE ON UPDATE CASCADE;
