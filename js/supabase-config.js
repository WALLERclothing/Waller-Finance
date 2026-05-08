/**
 * js/supabase-config.js
 * Configuração da conexão com o Supabase.
 */

const SUPABASE_URL = 'https://fcklgrrubqwaghahyieo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_q_3Lmc0auIK2_QAm3Wzezw_tgW94xLn';

// Usando o nome da biblioteca (supabase) para criar o cliente (supabaseClient)
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// Exportando como global para o resto do app usar
window.supabase = supabaseClient;
