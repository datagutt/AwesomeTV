var awesome = {};
awesome.init = function(){
	if(jessie && jessie.query && jessie.forEach && jessie.attachListener && jessie.cancelDefault){
		var downloadButtons = jessie.query('.download');
		jessie.forEach(downloadButtons, function(button){
			jessie.attachListener(button, 'click', function download(e){
				if(jessie.xhrSend){
					var show = jessie.query('[data-name]')[0].getAttribute('data-name');
					var episode = button.getAttribute('data-ep');
					jessie.xhrSend(jessie.createXhr(), '/api/download/' + show + '/' + episode, {
						success: function(status){
							if(status && status.responseText){
								alert(status.responseText);
							}
						}
					});
				}
				jessie.cancelDefault(e);
			});
		});
	}
};
jessie.attachDocumentReadyListener(awesome.init);