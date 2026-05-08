/**
 * js/supabase-config.js
 * Configuração da conexão com o Supabase.
 */

const SUPABASE_URL = 'https://fcklgrrubqwagbahyieo.supabase.co';
const SUPABASE_KEY = 'sb_publishable_q_3Lmc0auIK2_QAm3Wzezw_tgW94xLn';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

window.supabase = supabase;
