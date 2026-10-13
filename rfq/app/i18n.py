ACK = {
    "en": ("We received your enquiry {ref}",
           "Hello {name},\n\nThank you for your request. We have received it and stored it under the reference {ref}. "
           "A member of our team will review it and come back to you. Please quote this reference in any correspondence.\n\n"
           "Your request:\n{need}\n\nRevalx"),
    "de": ("Wir haben Ihre Anfrage {ref} erhalten",
           "Guten Tag {name},\n\nvielen Dank für Ihre Anfrage. Sie ist bei uns eingegangen und unter der Referenz {ref} gespeichert. "
           "Unser Team prüft sie und meldet sich bei Ihnen. Bitte nennen Sie diese Referenz in jeder Korrespondenz.\n\n"
           "Ihre Anfrage:\n{need}\n\nRevalx"),
    "es": ("Hemos recibido su consulta {ref}",
           "Hola {name}:\n\nGracias por su solicitud. La hemos recibido y registrado con la referencia {ref}. "
           "Nuestro equipo la revisará y se pondrá en contacto con usted. Indique esta referencia en cualquier comunicación.\n\n"
           "Su solicitud:\n{need}\n\nRevalx"),
    "fr": ("Nous avons bien reçu votre demande {ref}",
           "Bonjour {name},\n\nMerci pour votre demande. Nous l'avons reçue et enregistrée sous la référence {ref}. "
           "Notre équipe l'examine et reviendra vers vous. Merci d'indiquer cette référence dans tout échange.\n\n"
           "Votre demande :\n{need}\n\nRevalx"),
}


def ack(lang, name, ref, need):
    subject, body = ACK.get(lang, ACK["en"])
    return subject.format(ref=ref), body.format(name=name, ref=ref, need=need)
