-- CreateEnum
CREATE TYPE "Perfil" AS ENUM ('JURIDICO', 'DIRETORIA', 'CONTABILIDADE', 'ADMIN');

-- CreateEnum
CREATE TYPE "StatusImportacao" AS ENUM ('EM_ANDAMENTO', 'CONCLUIDA', 'CONCLUIDA_COM_PENDENCIAS', 'FALHOU', 'REVERTIDA');

-- CreateEnum
CREATE TYPE "TipoValidacao" AS ENUM ('COLUNA_NAO_RECONHECIDA', 'GERAL_DIVERGENTE', 'NUMERO_PROCESSO_REPETIDO', 'CONFLITO_BAIXADOS_ATIVA', 'AREA_DIVERGE_TIPO_ACAO', 'MGA_DESCONHECIDO', 'ACORDO_ORFAO', 'ABA_NAO_RECONHECIDA', 'VALOR_NAO_PARSEAVEL', 'DATA_NAO_PARSEAVEL');

-- CreateEnum
CREATE TYPE "Severidade" AS ENUM ('INFO', 'AVISO', 'ERRO');

-- CreateEnum
CREATE TYPE "Risco" AS ENUM ('PROVAVEL', 'POSSIVEL', 'REMOTO');

-- CreateEnum
CREATE TYPE "PoloCliente" AS ENUM ('ATIVA', 'PASSIVA', 'OUTROS');

-- CreateTable
CREATE TABLE "usuario" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "perfil" "Perfil" NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "acao" TEXT NOT NULL,
    "alvo" TEXT,
    "detalhe" JSONB,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "abaOrigem" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mga" (
    "id" TEXT NOT NULL,
    "nomeCanonico" TEXT NOT NULL,

    CONSTRAINT "mga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mga_sinonimo" (
    "id" TEXT NOT NULL,
    "mgaId" TEXT NOT NULL,
    "grafia" TEXT NOT NULL,

    CONSTRAINT "mga_sinonimo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "importacao" (
    "id" TEXT NOT NULL,
    "mesReferencia" TEXT NOT NULL,
    "status" "StatusImportacao" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "idempotencyKey" TEXT NOT NULL,
    "arquivoGeralNome" TEXT,
    "arquivoGeralHash" TEXT,
    "arquivoAcordosNome" TEXT,
    "arquivoAcordosHash" TEXT,
    "totalLinhasLidas" INTEGER NOT NULL DEFAULT 0,
    "totalLinhasGravadas" INTEGER NOT NULL DEFAULT 0,
    "totalPendencias" INTEGER NOT NULL DEFAULT 0,
    "usuarioId" TEXT,
    "iniciadaEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "concluidaEm" TIMESTAMP(3),

    CONSTRAINT "importacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mapeamento_coluna" (
    "id" TEXT NOT NULL,
    "campoLogico" TEXT NOT NULL,
    "apelido" TEXT NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mapeamento_coluna_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "log_validacao" (
    "id" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "tipo" "TipoValidacao" NOT NULL,
    "severidade" "Severidade" NOT NULL DEFAULT 'AVISO',
    "aba" TEXT,
    "linha" INTEGER,
    "campo" TEXT,
    "detalhe" TEXT NOT NULL,
    "resolvido" BOOLEAN NOT NULL DEFAULT false,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_validacao_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processo" (
    "id" TEXT NOT NULL,
    "numeroProcesso" TEXT,
    "fichaExterna" TEXT,
    "clienteId" TEXT,
    "criadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processo_snapshot" (
    "id" TEXT NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "abaOrigem" TEXT NOT NULL,
    "encerrado" BOOLEAN NOT NULL DEFAULT false,
    "tipoAcao" TEXT,
    "materia" TEXT,
    "area" TEXT,
    "fase" TEXT,
    "produto" TEXT,
    "autor" TEXT,
    "reu" TEXT,
    "todosEnvolvidos" TEXT,
    "comarca" TEXT,
    "uf" TEXT,
    "dataCadastro" TIMESTAMP(3),
    "dataAjuizamento" TIMESTAMP(3),
    "dataCitacao" TIMESTAMP(3),
    "dataEncerramento" TIMESTAMP(3),
    "tipoEncerramento" TEXT,
    "risco" "Risco",
    "valorProvisionado" DECIMAL(18,2),
    "justificativaProvisionamento" TEXT,
    "poloCliente" "PoloCliente",
    "valorCausa" DECIMAL(18,2),
    "valorAcordo" DECIMAL(18,2),
    "valorCondenacao" DECIMAL(18,2),
    "termosAcordo" TEXT,
    "dataCondenacao" TIMESTAMP(3),
    "exitoProcessoBruto" TEXT,
    "exitoProcessoNumerico" DECIMAL(18,2),
    "justificativaExito" TEXT,
    "resultadoSentenca" TEXT,
    "observacaoResultado" TEXT,
    "mgaId" TEXT,
    "mgaNoPoloPassivo" BOOLEAN,
    "placaVeiculo" TEXT,
    "numeroApolice" TEXT,
    "numeroSinistro" TEXT,
    "motivoSinistro" TEXT,
    "dataSinistro" TIMESTAMP(3),
    "oficina" TEXT,
    "statusBruto" TEXT,
    "situacaoAtual" TEXT,
    "proximosPassos" TEXT,
    "descricaoSumaria" TEXT,
    "camposNaoMapeados" JSONB,

    CONSTRAINT "processo_snapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parcela_acordo" (
    "id" TEXT NOT NULL,
    "processoId" TEXT NOT NULL,
    "mesReferencia" TEXT NOT NULL,
    "dataPagamento" TIMESTAMP(3),
    "valorParcela" DECIMAL(18,2) NOT NULL,
    "importacaoId" TEXT NOT NULL,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "parcela_acordo_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- CreateIndex
CREATE INDEX "log_auditoria_criadoEm_idx" ON "log_auditoria"("criadoEm");

-- CreateIndex
CREATE INDEX "log_auditoria_usuarioId_idx" ON "log_auditoria"("usuarioId");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_nome_key" ON "cliente"("nome");

-- CreateIndex
CREATE UNIQUE INDEX "mga_nomeCanonico_key" ON "mga"("nomeCanonico");

-- CreateIndex
CREATE UNIQUE INDEX "mga_sinonimo_grafia_key" ON "mga_sinonimo"("grafia");

-- CreateIndex
CREATE UNIQUE INDEX "importacao_idempotencyKey_key" ON "importacao"("idempotencyKey");

-- CreateIndex
CREATE INDEX "importacao_mesReferencia_idx" ON "importacao"("mesReferencia");

-- CreateIndex
CREATE INDEX "mapeamento_coluna_campoLogico_idx" ON "mapeamento_coluna"("campoLogico");

-- CreateIndex
CREATE UNIQUE INDEX "mapeamento_coluna_apelido_key" ON "mapeamento_coluna"("apelido");

-- CreateIndex
CREATE INDEX "log_validacao_importacaoId_resolvido_idx" ON "log_validacao"("importacaoId", "resolvido");

-- CreateIndex
CREATE INDEX "log_validacao_tipo_idx" ON "log_validacao"("tipo");

-- CreateIndex
CREATE INDEX "processo_numeroProcesso_idx" ON "processo"("numeroProcesso");

-- CreateIndex
CREATE INDEX "processo_fichaExterna_idx" ON "processo"("fichaExterna");

-- CreateIndex
CREATE INDEX "processo_snapshot_importacaoId_risco_idx" ON "processo_snapshot"("importacaoId", "risco");

-- CreateIndex
CREATE INDEX "processo_snapshot_importacaoId_area_idx" ON "processo_snapshot"("importacaoId", "area");

-- CreateIndex
CREATE INDEX "processo_snapshot_importacaoId_encerrado_idx" ON "processo_snapshot"("importacaoId", "encerrado");

-- CreateIndex
CREATE UNIQUE INDEX "processo_snapshot_importacaoId_processoId_key" ON "processo_snapshot"("importacaoId", "processoId");

-- CreateIndex
CREATE INDEX "parcela_acordo_mesReferencia_idx" ON "parcela_acordo"("mesReferencia");

-- CreateIndex
CREATE UNIQUE INDEX "parcela_acordo_processoId_mesReferencia_key" ON "parcela_acordo"("processoId", "mesReferencia");

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "log_auditoria_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mga_sinonimo" ADD CONSTRAINT "mga_sinonimo_mgaId_fkey" FOREIGN KEY ("mgaId") REFERENCES "mga"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "log_validacao" ADD CONSTRAINT "log_validacao_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "importacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo" ADD CONSTRAINT "processo_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "cliente"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo_snapshot" ADD CONSTRAINT "processo_snapshot_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "importacao"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo_snapshot" ADD CONSTRAINT "processo_snapshot_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processo_snapshot" ADD CONSTRAINT "processo_snapshot_mgaId_fkey" FOREIGN KEY ("mgaId") REFERENCES "mga"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcela_acordo" ADD CONSTRAINT "parcela_acordo_processoId_fkey" FOREIGN KEY ("processoId") REFERENCES "processo"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parcela_acordo" ADD CONSTRAINT "parcela_acordo_importacaoId_fkey" FOREIGN KEY ("importacaoId") REFERENCES "importacao"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
