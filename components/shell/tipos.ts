/**
 * Tipos compartilhados pela casca das telas.
 *
 * Vivem fora de `Sidebar.tsx` porque aquele arquivo é `'use client'`:
 * importar um tipo dele a partir de código de servidor cria uma aresta que o
 * bundler segue, e o módulo de servidor acaba classificado como alcançável
 * pelo cliente. Foi exatamente o que quebrou o build antes.
 *
 * Um arquivo só de tipos não gera JavaScript, então atravessa a fronteira
 * cliente/servidor sem custo nem risco.
 */

/**
 * O mínimo que a navegação precisa saber sobre quem está logado.
 *
 * Não é o usuário inteiro: id e e-mail ficam no servidor. Dado que não
 * trafega para o cliente não vaza dele.
 */
export interface UsuarioVisivel {
  nome: string
  /** Rótulo já traduzido — "Jurídico", não "JURIDICO". */
  perfil: string
  podeImportar: boolean
}
