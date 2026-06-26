import Handlebars from 'handlebars'

Handlebars.registerHelper('contains', function(this: any, texto: string, palabra: string, options: any) {
      if (texto && typeof texto === 'string' && texto.toLowerCase().includes(palabra.toLowerCase())) {
        return options.fn(this);
      }
      return options.inverse(this);
    });

export const formatMessage = (script: string, payload: JSON): string =>{
    const template = Handlebars.compile(script)
    return template(payload)
    }
