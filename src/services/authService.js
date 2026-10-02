const supabase = require('../config/supabase');

const loginWithEmail = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
};

const registerPartner = async (firstName, lastName, email, password) => {
    // 1. Register user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
    });

    if (authError) return { error: authError };

    // 2. Insert profile data into the public 'users' table
    // role_id 1 corresponds to 'partner'
    const { error: dbError } = await supabase
        .from('users')
        .insert([
            { 
                id: authData.user.id, 
                first_name: firstName, 
                last_name: lastName, 
                role_id: 1 
            }
        ]);

    if (dbError) return { error: dbError };

    return { data: authData, error: null };
};

module.exports = { loginWithEmail, registerPartner };