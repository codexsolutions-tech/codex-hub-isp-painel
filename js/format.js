function formatarTelefone(numero) {
    const digits = numero.replace(/\D/g, "");

    if (digits.length === 13) {
        return digits.replace(
            /^55(\d{2})(\d{5})(\d{4})$/,
            "($1) $2-$3"
        );
    }

    if (digits.length === 11) {
        return digits.replace(
            /^(\d{2})(\d{5})(\d{4})$/,
            "($1) $2-$3"
        );
    }

    if (digits.length === 10) {
        return digits.replace(
            /^(\d{2})(\d{4})(\d{4})$/,
            "($1) $2-$3"
        );
    }
    
    return numero;
}

function formataData(data) {

    if (!data) return "-";

    const d = new Date(data);

    return d.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
    }) + " " +
    d.toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit"
    });

}