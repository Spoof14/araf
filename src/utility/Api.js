
class Api{
    constructor() {
        this.baseUrl = process.env.REACT_APP_API_URL
    }

    _post(method, request, headers) {
		return fetch(`${this.baseUrl}/${method}`, {
			method: 'POST',
			body: JSON.stringify(request),
            headers: 
                headers 
                ?
                headers 
                :
                {
                    "content-type": "application/json",
			    }

		});
	}

	_get(method) {
		return fetch(`${this.baseUrl}/${method}`,
			{
				method: 'GET'
			}
		);
    }

    
    
}

export default Api;