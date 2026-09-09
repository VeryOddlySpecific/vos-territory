// jQuery document ready
jQuery(document).ready(function($){

    

    const getCityList = async () => {
        const response = await fetch('http://territorymap.local/wp-json/vos/v1/get-cities');
        const data = await response.json();
        
        console.log(data);

    }

    getCityList();

}); // end jQuery document ready