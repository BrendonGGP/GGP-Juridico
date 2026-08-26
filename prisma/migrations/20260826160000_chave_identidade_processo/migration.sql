-- Chave de identidade do processo entre importações (REGRA 5).
--
-- Permite reencontrar, no mês seguinte, o mesmo processo e manter o histórico
-- ligado. Derivada da ficha (ou do numeroProcesso, quando não há ficha).
-- NÃO é a chave técnica: esta continua sendo `id`, gerado pelo sistema.
--
-- A tabela está vazia neste momento, então o NOT NULL é seguro. Caso houvesse
-- dados, o caminho correto seria: adicionar nulável, preencher, depois travar.

-- AlterTable
ALTER TABLE "processo" ADD COLUMN     "chaveIdentidade" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "processo_chaveIdentidade_key" ON "processo"("chaveIdentidade");
