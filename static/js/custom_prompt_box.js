let customPromptBoxEnded = false;
const setCustomPromptBoxEnded = (trueOrFalse) => { customPromptBoxEnded = trueOrFalse; };


const customPromptBox = (title, notas, _callback) => {
  //'<label>Posição no tabuleiro</label>' +
  let content = '' +
  '<form action="" class="formName">' +
  '<div class="form-group">';
  if(notas !== '')
    content += '<label>'+notas+'</label>';
  content += '<input type="text" placeholder="Posição no tabuleiro" class="name form-control" required />' +
  '</div>' +
  '</form>';
  $.confirm({
    title: title,
    content: content,
    buttons: {
        formSubmit: {
            text: 'Submit',
            btnClass: 'btn-blue',
            action: function () {
                var name = this.$content.find('.name').val();
                if(!name){
                    $.alert('Por favor introduza uma coordenada');
                    return false;
                }
                _callback(name);
            }
        },
    },
    onContentReady: function () {
        // bind to events
        var jc = this;
        this.$content.find('form').on('submit', function (e) {
            // if the user submits the form by pressing enter in the field.
            e.preventDefault();
            jc.$$formSubmit.trigger('click'); // reference the button and click it
        });
    }
});
};

